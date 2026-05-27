import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MundialErpClient } from '../api-client.js';
import { sanitizeErrorForLlm } from '../errors.js';
import { formatDate } from '../formatters.js';
import type { ChatChannel, ChatMessageCreated, MessagesListResponse } from '../types/erp.js';

function formatChannels(channels: ChatChannel[]): string {
  if (channels.length === 0) return 'Você não está em nenhum canal.';
  return channels
    .map((c) => {
      const count = c._count.members;
      return `• ${c.name} [${c.type}] · ${count} membro${count === 1 ? '' : 's'} — id: ${c.id}`;
    })
    .join('\n');
}

function formatMessages(r: MessagesListResponse): string {
  if (r.data.length === 0) return 'Canal sem mensagens.';
  const lines = r.data.map((m) => {
    const author = m.author.name;
    const when = formatDate(m.createdAt);
    const edited = m.editedAt ? ' (editado)' : '';
    const replies =
      m.replyCount > 0 ? ` · ${m.replyCount} resposta${m.replyCount === 1 ? '' : 's'}` : '';
    return `[${when}] ${author}: ${m.content}${edited}${replies}`;
  });
  if (r.meta.cursor.hasMore && r.meta.cursor.next) {
    lines.push(`\n(há mais mensagens — use cursor=${r.meta.cursor.next})`);
  }
  return lines.join('\n');
}

export function registerChatReadTools(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_chat_channels_list',
    'Lists chat channels the current user is a member of, with type (PUBLIC/PRIVATE/DIRECT) and member count.',
    {},
    async () => {
      try {
        const channels = await client.get<ChatChannel[]>('/chat/channels');
        return { content: [{ type: 'text', text: formatChannels(channels) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_chat_messages_list',
    'Lists messages in a chat channel, cursor-paginated (default 20, max 100). Pass cursor for the next page.',
    {
      channelId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      try {
        const r = await client.getRaw<MessagesListResponse>(
          `/chat/channels/${args.channelId}/messages`,
          { cursor: args.cursor, limit: args.limit },
        );
        return { content: [{ type: 'text', text: formatMessages(r) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}

export function registerChatWriteTools(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_chat_message_send',
    'Sends a message to a chat channel. Content is plain text/markdown (max 40k chars). Optional: parentMessageId for thread reply, assigneeId to also assign someone.',
    {
      channelId: z.string(),
      content: z.string().min(1).max(40000),
      parentMessageId: z.string().optional(),
      assigneeId: z.string().optional(),
    },
    async ({ channelId, ...body }) => {
      try {
        const m = await client.post<ChatMessageCreated>(
          `/chat/channels/${channelId}/messages`,
          body,
        );
        return { content: [{ type: 'text', text: `Mensagem enviada (id: ${m.id}).` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}

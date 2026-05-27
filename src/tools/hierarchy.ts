import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MundialErpClient } from '../api-client.js';
import { sanitizeErrorForLlm } from '../errors.js';
import type { ListDetail, Space, Status } from '../types/erp.js';

function formatSpaces(spaces: Space[]): string {
  if (spaces.length === 0) return 'Nenhum space acessível.';
  const lines: string[] = [];
  for (const sp of spaces) {
    lines.push(`📁 ${sp.name} (id: ${sp.id})`);
    for (const f of sp.folders) {
      lines.push(`  └ ${f.name} (id: ${f.id})`);
      for (const l of f.lists) {
        lines.push(`     └ ${l.name} (id: ${l.id})`);
      }
    }
    if (sp.statuses.length > 0) {
      lines.push(`  Status do space: ${sp.statuses.map((s) => s.name).join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function formatListDetail(l: ListDetail): string {
  const lines = [`List: ${l.name}`, `ID: ${l.id}`, `Slug: ${l.slug}`, `Space: ${l.spaceId}`];
  if (l.folderId) lines.push(`Folder: ${l.folderId}`);
  if (l.defaultTaskType) lines.push(`Tipo padrão: ${l.defaultTaskType.value}`);
  lines.push(`Herança de status: ${l.statusInheritance}`);
  lines.push(`Privada: ${l.isPrivate ? 'sim' : 'não'}`);
  if (l.statuses.length > 0) {
    lines.push(`\nStatuses (${l.statuses.length}):`);
    for (const s of l.statuses) lines.push(`  • ${s.name} [${s.type}]`);
  }
  if (l.description) lines.push(`\nDescrição:\n${l.description}`);
  return lines.join('\n');
}

function formatStatusList(statuses: Status[]): string {
  if (statuses.length === 0) return 'Nenhum status configurado.';
  return statuses
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `• ${s.name} [${s.type}] · ${s.color}`)
    .join('\n');
}

export function registerHierarchyTools(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_spaces_list',
    'Lists all spaces the current user can access, with folders and lists nested as a tree. Use to discover what spaces/folders/lists exist before drilling into tasks.',
    {},
    async () => {
      try {
        const spaces = await client.get<Space[]>('/spaces');
        return { content: [{ type: 'text', text: formatSpaces(spaces) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_list_get',
    'Fetches metadata of one list by ID (name, slug, space, folder, default task type, status inheritance, statuses).',
    { listId: z.string() },
    async ({ listId }) => {
      try {
        const l = await client.get<ListDetail>(`/lists/${listId}`);
        return { content: [{ type: 'text', text: formatListDetail(l) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_status_list',
    'Lists the statuses available in a given list, ordered by position. Each status has name, type (NOT_STARTED/ACTIVE/DONE/CLOSED) and color.',
    { listId: z.string() },
    async ({ listId }) => {
      try {
        const statuses = await client.get<Status[]>(`/status/list/${listId}`);
        return { content: [{ type: 'text', text: formatStatusList(statuses) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}

export function registerStatusWriteTools(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_status_create',
    'Creates a new workflow status in a list/folder/space. Required: name, color (hex like #3b82f6), type (NOT_STARTED/ACTIVE/DONE/CLOSED), position, and exactly one scope id (listId, folderId, or spaceId).',
    {
      name: z.string().min(1),
      color: z.string(),
      type: z.enum(['NOT_STARTED', 'ACTIVE', 'DONE', 'CLOSED']),
      position: z.number().int().min(0),
      listId: z.string().optional(),
      folderId: z.string().optional(),
      spaceId: z.string().optional(),
    },
    async (args) => {
      try {
        const s = await client.post<Status>('/status', args);
        return {
          content: [
            { type: 'text', text: `Status criado: ${s.name} [${s.type}] · ${s.color} — id: ${s.id}` },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_status_update',
    'Updates an existing status: rename, change color, reorder, or change type. All fields except statusId are optional.',
    {
      statusId: z.string(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      type: z.enum(['NOT_STARTED', 'ACTIVE', 'DONE', 'CLOSED']).optional(),
      position: z.number().int().min(0).optional(),
    },
    async ({ statusId, ...rest }) => {
      try {
        const s = await client.put<Status>(`/status/${statusId}`, { id: statusId, ...rest });
        return {
          content: [{ type: 'text', text: `Status atualizado: ${s.name} [${s.type}] · ${s.color}` }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_status_delete',
    'Deletes a status from its scope. WARNING: tasks currently assigned to this status will be orphaned (no automatic migration). Always confirm with the user before calling.',
    { statusId: z.string() },
    async ({ statusId }) => {
      try {
        await client.delete(`/status/${statusId}`);
        return {
          content: [
            {
              type: 'text',
              text: `Status ${statusId} removido. ATENÇÃO: tasks que estavam nele ficaram órfãs — confira no ERP.`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}

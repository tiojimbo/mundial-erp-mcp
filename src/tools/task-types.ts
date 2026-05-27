import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MundialErpClient } from '../api-client.js';
import { sanitizeErrorForLlm } from '../errors.js';
import type { TaskType } from '../types/erp.js';

function formatTaskTypes(types: TaskType[]): string {
  if (types.length === 0) return 'Nenhum task-type definido nesse workspace.';
  const seen = new Set<string>();
  const dedup: TaskType[] = [];
  for (const t of types) {
    if (!seen.has(t.value)) {
      seen.add(t.value);
      dedup.push(t);
    }
  }
  return dedup
    .map((t) => `• ${t.value} (${t.pluralName})${t.isBuiltin ? ' [builtin]' : ''} — id: ${t.id}`)
    .join('\n');
}

function formatTaskType(t: TaskType): string {
  const lines = [
    `Tipo: ${t.value}`,
    `Plural: ${t.pluralName}`,
    `ID: ${t.id}`,
    `Builtin: ${t.isBuiltin ? 'sim' : 'não'}`,
    `Space: ${t.spaceId}`,
  ];
  if (t.icon) lines.push(`Ícone: ${t.icon}`);
  if (t.color) lines.push(`Cor: ${t.color}`);
  if (t.description) lines.push(`\nDescrição:\n${t.description}`);
  if (t.creator) lines.push(`\nCriado por: ${t.creator.name} (${t.creator.email})`);
  return lines.join('\n');
}

export function registerTaskTypeTools(
  server: McpServer,
  client: MundialErpClient,
  workspaceId: string,
): void {
  server.tool(
    'erp_task_types_list',
    'Lists task-types in the current workspace, deduplicated by name (mirrors Hoppe selector behavior).',
    {},
    async () => {
      try {
        const types = await client.get<TaskType[]>(`/workspaces/${workspaceId}/task-types`);
        return { content: [{ type: 'text', text: formatTaskTypes(types) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_task_type_get',
    'Fetches one task-type by ID (value, plural, icon, color, creator, space).',
    { taskTypeId: z.string() },
    async ({ taskTypeId }) => {
      try {
        const r = await client.get<{ data: TaskType }>(`/custom-task-types/${taskTypeId}`);
        return { content: [{ type: 'text', text: formatTaskType(r.data) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}

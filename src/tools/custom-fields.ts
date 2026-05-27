import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MundialErpClient } from '../api-client.js';
import { sanitizeErrorForLlm } from '../errors.js';
import type { CustomFieldDefinition, GroupedCustomFields } from '../types/erp.js';

function formatCustomFields(g: GroupedCustomFields): string {
  const scopes: Array<[string, CustomFieldDefinition[]]> = [
    ['Workspace', g.workspace],
    ['Space', g.space],
    ['Folder', g.folder],
    ['List', g.list],
    ['Task type', g.taskType],
  ];
  const lines: string[] = [];
  for (const [label, defs] of scopes) {
    if (defs.length === 0) continue;
    lines.push(`${label} (${defs.length}):`);
    for (const d of defs) {
      const req = d.required ? ' [obrigatório]' : '';
      lines.push(`  • ${d.name} [${d.type}]${req} — id: ${d.id}`);
    }
    lines.push('');
  }
  if (lines.length === 0) return 'Nenhum custom-field definido nesse workspace.';
  return lines.join('\n').trim();
}

export function registerCustomFieldTools(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_custom_fields_list',
    'Lists custom-field definitions grouped by scope (workspace/space/folder/list/taskType).',
    {},
    async () => {
      try {
        const g = await client.get<GroupedCustomFields>('/custom-fields');
        return { content: [{ type: 'text', text: formatCustomFields(g) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_custom_field_set',
    'Sets the value of one custom field on a task. Value type depends on the field type (string/number/boolean/null to clear). Use after listing definitions to know which id and type apply.',
    {
      taskId: z.string(),
      definitionId: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    },
    async ({ taskId, definitionId, value }) => {
      try {
        await client.put(`/tasks/${taskId}/custom-fields/${definitionId}`, { value });
        return { content: [{ type: 'text', text: 'Custom field atualizado.' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}

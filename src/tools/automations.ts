import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MundialErpClient } from '../api-client.js';
import { sanitizeErrorForLlm } from '../errors.js';
import type { Automation } from '../types/erp.js';

function formatAutomations(list: Automation[]): string {
  if (list.length === 0) return 'Nenhuma automation configurada nesse workspace.';
  return list
    .map((a) => {
      const active = a.isActive ? '✓' : '✗';
      return `${active} ${a.name} — trigger: ${a.trigger} · escopo: ${a.scopeType} — id: ${a.id}`;
    })
    .join('\n');
}

function formatAutomationDetail(a: Automation): string {
  const lines = [
    `Automation: ${a.name}`,
    `ID: ${a.id}`,
    `Status: ${a.isActive ? 'ativa' : 'inativa'}`,
    `Trigger: ${a.trigger}`,
    `Escopo: ${a.scopeType} (${a.scopeId})`,
  ];
  if (a.actions && a.actions.length > 0) {
    lines.push(`\nActions (${a.actions.length}):`);
    for (const ac of a.actions) lines.push(`  • ${ac.type}`);
  }
  if (a.description) lines.push(`\nDescrição:\n${a.description}`);
  return lines.join('\n');
}

export function registerAutomationTools(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_automations_list',
    'Lists workspace automations with optional filters: trigger, scopeType, scopeId, isActive.',
    {
      trigger: z.string().optional(),
      scopeType: z.string().optional(),
      scopeId: z.string().optional(),
      isActive: z.boolean().optional(),
    },
    async (args) => {
      try {
        const list = await client.get<Automation[]>('/ai/automation', args);
        return { content: [{ type: 'text', text: formatAutomations(list) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_automation_get',
    'Fetches one automation by ID with trigger + actions detail.',
    { automationId: z.string() },
    async ({ automationId }) => {
      try {
        const a = await client.get<Automation>(`/ai/automation/${automationId}`);
        return { content: [{ type: 'text', text: formatAutomationDetail(a) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}

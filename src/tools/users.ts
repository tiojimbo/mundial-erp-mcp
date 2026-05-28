import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MundialErpClient } from '../api-client.js';
import { sanitizeErrorForLlm } from '../errors.js';
import type { ErpUser, UsersListResponse } from '../types/erp.js';

function formatUserLine(u: ErpUser): string {
  const status = u.isActive ? '' : ' (inativo)';
  return `• ${u.name} <${u.email}> · ${u.role}${status} — id: ${u.id}`;
}

function formatUsersList(r: UsersListResponse): string {
  if (r.data.length === 0) return 'Nenhum usuário encontrado.';
  const lines = r.data.map(formatUserLine);
  const p = r.meta.pagination;
  lines.push(`\nMostrando ${r.data.length} de ${p.total} · página ${p.page}/${p.totalPages}`);
  return lines.join('\n');
}

function formatUserDetail(u: ErpUser): string {
  return [
    `Usuário: ${u.name}`,
    `Email: ${u.email}`,
    `ID: ${u.id}`,
    `Papel: ${u.role}`,
    `Status: ${u.isActive ? 'ativo' : 'inativo'}`,
  ].join('\n');
}

export function registerUserTools(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_users_list',
    'Lists users in the workspace (name, email, role, active status). Use to discover user IDs needed for assigning tasks or filtering by assignee.',
    {
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      try {
        const r = await client.getRaw<UsersListResponse>('/users', args);
        return { content: [{ type: 'text', text: formatUsersList(r) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );

  server.tool(
    'erp_user_get',
    'Fetches one user by ID (name, email, role, active status).',
    { userId: z.string() },
    async ({ userId }) => {
      try {
        const u = await client.get<ErpUser>(`/users/${userId}`);
        return { content: [{ type: 'text', text: formatUserDetail(u) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: sanitizeErrorForLlm(err) }], isError: true };
      }
    },
  );
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MundialErpClient } from '../api-client.js';
import type { AuthenticatedUser, Workspace } from '../auth.js';
import { sanitizeErrorForLlm } from '../errors.js';

function format(user: AuthenticatedUser, workspaces: Workspace[]): string {
  const lines = [
    `Você é: ${user.name} (${user.email})`,
    `Papel: ${user.role}`,
    `Status: ${user.isActive ? 'ativo' : 'inativo'}`,
  ];
  if (workspaces.length === 1) {
    const ws = workspaces[0];
    if (ws) lines.push(`Workspace: ${ws.name} (${ws.slug})`);
  } else if (workspaces.length > 1) {
    lines.push(`Workspaces (${workspaces.length}): ${workspaces.map((w) => w.name).join(', ')}`);
  }
  return lines.join('\n');
}

export function registerMeTool(server: McpServer, client: MundialErpClient): void {
  server.tool(
    'erp_me',
    "Identifies the current user behind the API key (name, email, role, active workspace). Use as a sanity check or when the user asks 'who am I'.",
    {},
    async () => {
      try {
        const [user, workspaces] = await Promise.all([
          client.get<AuthenticatedUser>('/auth/me'),
          client.get<Workspace[]>('/workspaces').catch(() => [] as Workspace[]),
        ]);
        return { content: [{ type: 'text', text: format(user, workspaces) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: sanitizeErrorForLlm(err) }],
          isError: true,
        };
      }
    },
  );
}

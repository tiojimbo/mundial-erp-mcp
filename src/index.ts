import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MundialErpClient } from './api-client.js';
import { listWorkspaces, validateApiKey } from './auth.js';
import { loadConfig, type StdioConfig } from './config.js';
import { sanitizeErrorForLlm } from './errors.js';
import { logger, maskApiKey } from './logger.js';
import { runHttp } from './http.js';
import { registerAutomationTools } from './tools/automations.js';
import { registerChatReadTools, registerChatWriteTools } from './tools/chat.js';
import { registerCustomFieldTools } from './tools/custom-fields.js';
import { registerHierarchyTools, registerStatusWriteTools } from './tools/hierarchy.js';
import { registerMeTool } from './tools/me.js';
import { registerTaskTypeTools } from './tools/task-types.js';
import { registerTaskReadTools, registerTaskWriteTools } from './tools/tasks.js';
import { registerUserTools } from './tools/users.js';

const SERVER_NAME = 'mundial-erp-mcp';
const SERVER_VERSION = '0.1.0';

async function runStdio(config: StdioConfig): Promise<void> {
  const client = new MundialErpClient(config.apiKey, config.apiUrl, config.timeoutMs);
  const user = await validateApiKey(client);
  const workspaces = await listWorkspaces(client);
  const activeWorkspaceId = workspaces[0]?.id;
  if (!activeWorkspaceId) {
    logger.error('Chave não tem workspace acessível');
    process.exit(1);
  }

  logger.info('chave validada', {
    keyPrefix: maskApiKey(config.apiKey),
    userId: user.id,
    role: user.role,
    workspaceId: activeWorkspaceId,
  });

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerMeTool(server, client);
  registerTaskReadTools(server, client);
  registerTaskWriteTools(server, client);
  registerHierarchyTools(server, client);
  registerStatusWriteTools(server, client);
  registerTaskTypeTools(server, client, activeWorkspaceId);
  registerCustomFieldTools(server, client);
  registerChatReadTools(server, client);
  registerChatWriteTools(server, client);
  registerAutomationTools(server, client);
  registerUserTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server stdio conectado', { tools: 26 });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args.includes('--stdio') ? 'stdio' : 'http';

  try {
    const config = loadConfig(mode);
    if (config.mode === 'stdio') {
      await runStdio(config);
      return;
    }
    await runHttp(config);
  } catch (err) {
    logger.error('Falha ao iniciar', { error: sanitizeErrorForLlm(err) });
    process.exit(1);
  }
}

void main();

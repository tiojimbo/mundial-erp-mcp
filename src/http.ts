import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response } from 'express';
import { MundialErpClient } from './api-client.js';
import { listWorkspaces, validateApiKey } from './auth.js';
import type { HttpConfig } from './config.js';
import { AuthError, sanitizeErrorForLlm } from './errors.js';
import { logger, maskApiKey } from './logger.js';
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

type StreamableSession = { transport: StreamableHTTPServerTransport; server: McpServer };
type SseSession = { transport: SSEServerTransport; server: McpServer };

function extractApiKey(req: Request): string | null {
  const header = req.header('authorization')?.trim();
  if (!header) return null;
  const token = (header.toLowerCase().startsWith('bearer ') ? header.slice(7) : header).trim();
  if (!token || !token.startsWith('pk_')) return null;
  return token;
}

async function requireAuth(
  req: Request,
  res: Response,
  config: HttpConfig,
): Promise<{ client: MundialErpClient; wsId: string } | null> {
  const key = extractApiKey(req);
  if (!key) {
    res
      .status(401)
      .json({ error: 'Missing or invalid token. Use: Authorization: Bearer pk_...' });
    return null;
  }
  try {
    const client = new MundialErpClient(key, config.apiUrl, config.timeoutMs);
    await validateApiKey(client);
    const workspaces = await listWorkspaces(client);
    const wsId = workspaces[0]?.id;
    if (!wsId) {
      res.status(403).json({ error: 'No accessible workspace.' });
      return null;
    }
    return { client, wsId };
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: sanitizeErrorForLlm(err) });
      return null;
    }
    res.status(500).json({ error: sanitizeErrorForLlm(err) });
    return null;
  }
}

function createServer(client: MundialErpClient, wsId: string): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerMeTool(server, client);
  registerTaskReadTools(server, client);
  registerTaskWriteTools(server, client);
  registerHierarchyTools(server, client);
  registerStatusWriteTools(server, client);
  registerTaskTypeTools(server, client, wsId);
  registerCustomFieldTools(server, client);
  registerChatReadTools(server, client);
  registerChatWriteTools(server, client);
  registerAutomationTools(server, client);
  registerUserTools(server, client);
  return server;
}

export async function runHttp(config: HttpConfig): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: SERVER_NAME, version: SERVER_VERSION });
  });

  const streamableTransports = new Map<string, StreamableSession>();

  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && streamableTransports.has(sessionId)) {
      const entry = streamableTransports.get(sessionId);
      if (entry) {
        await entry.transport.handleRequest(req, res, req.body);
        return;
      }
    }

    if (req.method === 'POST') {
      const auth = await requireAuth(req, res, config);
      if (!auth) return;

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      const server = createServer(auth.client, auth.wsId);

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) streamableTransports.delete(sid);
        server.close().catch(() => {});
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      const sid = transport.sessionId;
      if (sid) {
        streamableTransports.set(sid, { transport, server });
        const key = extractApiKey(req);
        logger.info('sessão streamable iniciada', {
          sessionId: sid,
          keyPrefix: key ? maskApiKey(key) : '?',
        });
      }
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      res.status(400).json({ error: 'No active session. Send a POST to initialize.' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  });

  const sseTransports = new Map<string, SseSession>();

  app.get('/sse', async (req, res) => {
    const auth = await requireAuth(req, res, config);
    if (!auth) return;

    const transport = new SSEServerTransport('/messages', res);
    const server = createServer(auth.client, auth.wsId);

    transport.onclose = () => {
      sseTransports.delete(transport.sessionId);
      server.close().catch(() => {});
    };

    await server.connect(transport);
    sseTransports.set(transport.sessionId, { transport, server });
    const key = extractApiKey(req);
    logger.info('sessão sse iniciada', {
      sessionId: transport.sessionId,
      keyPrefix: key ? maskApiKey(key) : '?',
    });
    await transport.start();
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const entry = sseTransports.get(sessionId);
    if (!entry) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    await entry.transport.handlePostMessage(req, res, req.body);
  });

  app.listen(config.port, '0.0.0.0', () => {
    logger.info('mundial-erp-mcp HTTP listening', { port: config.port });
  });
}

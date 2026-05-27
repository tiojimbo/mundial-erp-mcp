import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
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

const SERVER_NAME = 'mundial-erp-mcp';
const SERVER_VERSION = '0.1.0';

type StreamableSession = { transport: StreamableHTTPServerTransport; server: McpServer };
type SseSession = { transport: SSEServerTransport; server: McpServer };

function extractApiKey(req: Request): string {
  const header = req.header('authorization') ?? '';
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) throw new AuthError(401);
  const key = value.trim();
  if (!key.startsWith('pk_')) throw new AuthError(403);
  return key;
}

async function buildServer(apiKey: string, config: HttpConfig): Promise<McpServer> {
  const client = new MundialErpClient(apiKey, config.apiUrl, config.timeoutMs);
  await validateApiKey(client);
  const workspaces = await listWorkspaces(client);
  const wsId = workspaces[0]?.id;
  if (!wsId) throw new AuthError(403);
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
  return server;
}

export async function runHttp(config: HttpConfig): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('CORS bloqueado'), false);
      },
      credentials: true,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: SERVER_NAME, version: SERVER_VERSION });
  });

  const streamable = new Map<string, StreamableSession>();
  const sse = new Map<string, SseSession>();

  app.post('/mcp', async (req, res) => {
    try {
      const apiKey = extractApiKey(req);
      const sessionId = req.header('mcp-session-id');
      let session = sessionId ? streamable.get(sessionId) : undefined;
      if (!session) {
        const server = await buildServer(apiKey, config);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            streamable.set(id, { transport, server });
            logger.info('sessão streamable iniciada', {
              sessionId: id,
              keyPrefix: maskApiKey(apiKey),
            });
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) streamable.delete(transport.sessionId);
        };
        await server.connect(transport);
        session = { transport, server };
      }
      await session.transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: sanitizeErrorForLlm(err) });
        return;
      }
      logger.error('erro em POST /mcp', {
        error: err instanceof Error ? err.message : 'unknown',
      });
      res.status(500).json({ error: sanitizeErrorForLlm(err) });
    }
  });

  app.get('/sse', async (req, res) => {
    try {
      const apiKey = extractApiKey(req);
      const server = await buildServer(apiKey, config);
      const transport = new SSEServerTransport('/messages', res);
      sse.set(transport.sessionId, { transport, server });
      transport.onclose = () => sse.delete(transport.sessionId);
      await server.connect(transport);
      logger.info('sessão sse iniciada', {
        sessionId: transport.sessionId,
        keyPrefix: maskApiKey(apiKey),
      });
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: sanitizeErrorForLlm(err) });
        return;
      }
      res.status(500).json({ error: sanitizeErrorForLlm(err) });
    }
  });

  app.post('/messages', async (req, res) => {
    const sessionId = (req.query.sessionId as string) ?? '';
    const session = sse.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }
    await session.transport.handlePostMessage(req, res, req.body);
  });

  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err.message === 'CORS bloqueado') {
      res.status(403).json({ error: 'Origem não permitida.' });
      return;
    }
    logger.error('erro Express não tratado', { error: err.message });
    res.status(500).json({ error: 'Erro interno.' });
  });

  app.listen(config.port, () => {
    logger.info('mundial-erp-mcp HTTP listening', {
      port: config.port,
      corsOrigins: config.corsOrigins,
    });
  });
}

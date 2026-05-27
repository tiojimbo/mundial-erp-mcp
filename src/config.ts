import { z } from 'zod';

const StdioSchema = z.object({
  mode: z.literal('stdio'),
  apiUrl: z.string().url(),
  apiKey: z.string().regex(/^pk_/, 'MUNDIAL_ERP_API_KEY precisa começar com pk_'),
  timeoutMs: z.number().int().positive().default(15000),
});

const HttpSchema = z.object({
  mode: z.literal('http'),
  apiUrl: z.string().url(),
  port: z.number().int().positive(),
  timeoutMs: z.number().int().positive().default(15000),
  corsOrigins: z.array(z.string().url()).default([]),
});

export type StdioConfig = z.infer<typeof StdioSchema>;
export type HttpConfig = z.infer<typeof HttpSchema>;
export type Config = StdioConfig | HttpConfig;

export function loadConfig(mode: 'stdio' | 'http'): Config {
  const apiUrl = process.env.MUNDIAL_ERP_API_URL ?? 'http://localhost:3001';
  const timeoutMs = Number(process.env.MUNDIAL_ERP_TIMEOUT_MS ?? 15000);

  if (mode === 'stdio') {
    return StdioSchema.parse({
      mode: 'stdio',
      apiUrl,
      apiKey: process.env.MUNDIAL_ERP_API_KEY,
      timeoutMs,
    });
  }

  const corsOrigins = (process.env.MUNDIAL_ERP_MCP_CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  return HttpSchema.parse({
    mode: 'http',
    apiUrl,
    port: Number(process.env.PORT ?? 3120),
    timeoutMs,
    corsOrigins,
  });
}

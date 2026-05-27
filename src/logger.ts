type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  process.stderr.write(line + '\n');
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => write('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write('error', message, fields),
};

export function maskApiKey(key: string): string {
  if (!key.startsWith('pk_')) return '***';
  return key.slice(0, 8) + '...';
}

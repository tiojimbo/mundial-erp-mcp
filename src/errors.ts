import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`API ${status}`);
    this.name = 'ApiError';
  }
}

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? 'API key ausente ou inválida' : 'API key revogada ou expirada');
    this.name = 'AuthError';
  }
}

export function sanitizeErrorForLlm(err: unknown): string {
  if (err instanceof z.ZodError) {
    return `Argumento inválido: ${err.issues.map((i) => `${i.path.join('.')} — ${i.message}`).join('; ')}`;
  }
  if (err instanceof AuthError) {
    return 'Sua chave de API foi rejeitada pelo ERP. Verifique MUNDIAL_ERP_API_KEY ou gere uma nova na página "API" do Mundial ERP.';
  }
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return 'Sua chave de API foi rejeitada pelo ERP. Verifique MUNDIAL_ERP_API_KEY ou gere uma nova na página "API" do Mundial ERP.';
    }
    if (err.status === 404) return 'Recurso não encontrado.';
    if (err.status === 429) return 'Limite de requisições atingido. Tente novamente em alguns segundos.';
    if (err.status >= 400 && err.status < 500) {
      try {
        const parsed = JSON.parse(err.body) as {
          message?: string | string[];
          meta?: { error?: string };
        };
        const apiMessage = parsed.meta?.error ?? parsed.message;
        if (apiMessage) {
          const msg = Array.isArray(apiMessage) ? apiMessage.join('; ') : apiMessage;
          return `Erro de validação: ${msg}`;
        }
      } catch {
        // fall through
      }
      return `Erro na requisição (${err.status}).`;
    }
    return 'O ERP está indisponível no momento. Tente novamente em alguns minutos.';
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return 'O ERP demorou demais para responder. Tente novamente.';
  }
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: { code?: string } }).cause;
    const code = cause?.code ?? '';
    if (code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
      return 'Não foi possível conectar ao ERP. Verifique se o serviço está rodando.';
    }
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return 'Não foi possível resolver o endereço do ERP. Verifique MUNDIAL_ERP_API_URL.';
    }
    if (code === 'ETIMEDOUT' || code === 'ECONNRESET') {
      return 'A conexão com o ERP caiu. Tente novamente.';
    }
  }
  return 'Erro inesperado ao consultar o ERP.';
}

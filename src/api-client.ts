import { ApiError, AuthError } from './errors.js';

type QueryValue = string | number | boolean | undefined;
type QueryParams = Record<string, QueryValue | QueryValue[]>;

export class MundialErpClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.request<T>('GET', path, params);
  }
  getRaw<T>(path: string, params?: QueryParams): Promise<T> {
    return this.request<T>('GET', path, params, undefined, true);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, undefined, body);
  }
  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, undefined, body);
  }
  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(
    method: string,
    path: string,
    params?: QueryParams,
    body?: unknown,
    raw = false,
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 401) throw new AuthError(401);
      if (res.status === 403) throw new AuthError(403);
      const text = await res.text();
      if (!res.ok) throw new ApiError(res.status, text);
      if (text.length === 0) return undefined as T;
      const parsed = JSON.parse(text) as { data?: unknown };
      if (raw) return parsed as T;
      return (parsed.data ?? parsed) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(path: string, params?: QueryParams): string {
    const url = new URL(`/api/v1${path.startsWith('/') ? path : `/${path}`}`, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            if (v !== undefined) url.searchParams.append(key, String(v));
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
}

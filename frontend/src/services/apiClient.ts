import { clearAuthSession, getAuthSession } from './authSession';
import type { ApiErrorResponse } from '../types/admin';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors?: ApiErrorResponse['fieldErrors'];
  readonly traceId?: string;
  readonly currentVersion?: number;

  constructor(response: ApiErrorResponse) {
    super(response.message || `HTTP ${response.status}`);
    this.name = 'ApiError';
    this.status = response.status;
    this.code = response.code;
    this.fieldErrors = response.fieldErrors;
    this.traceId = response.traceId;
    this.currentVersion = response.currentVersion;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  authenticated?: boolean;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    return text || undefined;
  }
  return response.json() as Promise<unknown>;
}

function normalizeError(status: number, raw: unknown): ApiErrorResponse {
  if (raw && typeof raw === 'object') {
    const candidate = raw as Partial<ApiErrorResponse>;
    return {
      status,
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      fieldErrors: candidate.fieldErrors,
      traceId: typeof candidate.traceId === 'string' ? candidate.traceId : undefined,
      currentVersion:
        typeof candidate.currentVersion === 'number' ? candidate.currentVersion : undefined,
    };
  }
  return { status, message: typeof raw === 'string' ? raw : undefined };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const authenticated = options.authenticated ?? true;
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  if (authenticated) {
    const session = getAuthSession();
    if (session) headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Network request failed' });
  }

  const raw = await parseResponseBody(response);
  if (!response.ok) {
    if (response.status === 401 && authenticated) clearAuthSession('expired');
    throw new ApiError(normalizeError(response.status, raw));
  }
  return raw as T;
}

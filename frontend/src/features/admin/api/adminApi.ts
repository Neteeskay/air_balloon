import { apiRequest } from '../../../services/apiClient';
import type {
  AuditAction,
  AuditResponse,
  ConfigMetadataResponse,
  DiffResponse,
  GameConfigurationCandidateRequest,
  GameConfigurationResponse,
  LoginRequest,
  LoginResponse,
  PageResponse,
  ValidationResponse,
  VersionSummary,
} from '../../../types/admin';

export interface AuditFilters {
  action?: AuditAction | '';
  administrator?: string;
  version?: string;
  from?: string;
  to?: string;
  page: number;
  size: number;
}

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

export const adminApi = {
  login: (request: LoginRequest, signal?: AbortSignal) =>
    apiRequest<LoginResponse>('/api/admin/auth/login', {
      method: 'POST',
      body: request,
      signal,
      authenticated: false,
    }),
  logout: (signal?: AbortSignal) =>
    apiRequest<void>('/api/admin/auth/logout', { method: 'POST', signal }),
  currentConfig: (signal?: AbortSignal) =>
    apiRequest<GameConfigurationResponse>('/api/admin/config/current', { signal }),
  metadata: (signal?: AbortSignal) =>
    apiRequest<ConfigMetadataResponse>('/api/admin/config/metadata', { signal }),
  validate: (request: GameConfigurationCandidateRequest, signal?: AbortSignal) =>
    apiRequest<ValidationResponse>('/api/admin/config/validate', {
      method: 'POST',
      body: request,
      signal,
    }),
  createDraft: (request: GameConfigurationCandidateRequest, signal?: AbortSignal) =>
    apiRequest<GameConfigurationResponse>('/api/admin/config', {
      method: 'POST',
      body: request,
      signal,
    }),
  activate: (id: string, signal?: AbortSignal) =>
    apiRequest<GameConfigurationResponse>(`/api/admin/config/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
      signal,
    }),
  versions: (page: number, size: number, signal?: AbortSignal) =>
    apiRequest<PageResponse<VersionSummary>>(
      `/api/admin/config/versions?${queryString({ page, size })}`,
      { signal },
    ),
  version: (id: string, signal?: AbortSignal) =>
    apiRequest<GameConfigurationResponse>(
      `/api/admin/config/versions/${encodeURIComponent(id)}`,
      { signal },
    ),
  diff: (fromId: string, toId: string, signal?: AbortSignal) =>
    apiRequest<DiffResponse>(
      `/api/admin/config/versions/${encodeURIComponent(fromId)}/diff/${encodeURIComponent(toId)}`,
      { signal },
    ),
  rollback: (id: string, signal?: AbortSignal) =>
    apiRequest<GameConfigurationResponse>(
      `/api/admin/config/versions/${encodeURIComponent(id)}/rollback`,
      { method: 'POST', signal },
    ),
  audit: (filters: AuditFilters, signal?: AbortSignal) => {
    const query = queryString({
      action: filters.action || undefined,
      administrator: filters.administrator || undefined,
      version: filters.version || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: filters.page,
      size: filters.size,
    });
    return apiRequest<AuditResponse>(`/api/admin/audit?${query}`, { signal });
  },
};

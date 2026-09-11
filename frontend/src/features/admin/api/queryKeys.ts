import type { AuditFilters } from './adminApi';

export const adminKeys = {
  all: ['admin'] as const,
  current: () => [...adminKeys.all, 'current'] as const,
  metadata: () => [...adminKeys.all, 'metadata'] as const,
  versions: (page: number, size: number) => [...adminKeys.all, 'versions', page, size] as const,
  version: (id: string) => [...adminKeys.all, 'version', id] as const,
  diff: (fromId: string, toId: string) => [...adminKeys.all, 'diff', fromId, toId] as const,
  audit: (filters: AuditFilters) => [...adminKeys.all, 'audit', filters] as const,
};

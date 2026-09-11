import { useQuery } from '@tanstack/react-query';
import { adminApi, type AuditFilters } from '../api/adminApi';
import { adminKeys } from '../api/queryKeys';

export const useCurrentConfig = () =>
  useQuery({
    queryKey: adminKeys.current(),
    queryFn: ({ signal }) => adminApi.currentConfig(signal),
    staleTime: 20_000,
    retry: false,
  });

export const useConfigMetadata = () =>
  useQuery({
    queryKey: adminKeys.metadata(),
    queryFn: ({ signal }) => adminApi.metadata(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  });

export const useVersions = (page: number, size: number) =>
  useQuery({
    queryKey: adminKeys.versions(page, size),
    queryFn: ({ signal }) => adminApi.versions(page, size, signal),
    placeholderData: (previous) => previous,
  });

export const useVersion = (id: string) =>
  useQuery({
    queryKey: adminKeys.version(id),
    queryFn: ({ signal }) => adminApi.version(id, signal),
    enabled: Boolean(id),
    retry: false,
  });

export const useVersionDiff = (fromId: string, toId: string, enabled = true) =>
  useQuery({
    queryKey: adminKeys.diff(fromId, toId),
    queryFn: ({ signal }) => adminApi.diff(fromId, toId, signal),
    enabled: enabled && Boolean(fromId) && Boolean(toId) && fromId !== toId,
    retry: false,
  });

export const useAudit = (filters: AuditFilters) =>
  useQuery({
    queryKey: adminKeys.audit(filters),
    queryFn: ({ signal }) => adminApi.audit(filters, signal),
    placeholderData: (previous) => previous,
  });

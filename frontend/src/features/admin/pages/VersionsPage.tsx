import { Eye } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, Pagination, Skeleton, StatusBadge } from '../../../components/ui/primitives';
import { useVersions } from '../hooks/useAdminQueries';
import { formatDateTime } from '../utils/format';

export function VersionsPage() {
  const [page, setPage] = useState(0);
  const size = 20;
  const versions = useVersions(page, size);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><p className="eyebrow">Конфигурация</p><h1>История версий</h1></div>
        <p>Здесь видны все сохранённые конфигурации и выполненные откаты.</p>
      </div>

      {versions.isLoading ? <TableSkeleton /> : null}
      {versions.isError ? <ErrorState error={versions.error} onRetry={() => void versions.refetch()} /> : null}
      {versions.data && versions.data.content.length === 0 ? <EmptyState title="Версий пока нет" description="Сохранённые конфигурации пока отсутствуют." /> : null}

      {versions.data && versions.data.content.length > 0 ? (
        <>
          <div className="table-card table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Версия</th>
                  <th>Статус</th>
                  <th>Создана</th>
                  <th>Активирована</th>
                  <th>Основа</th>
                  <th>Источник</th>
                  <th><span className="sr-only">Действия</span></th>
                </tr>
              </thead>
              <tbody>
                {versions.data.content.map((version) => (
                  <tr key={version.id}>
                    <td><strong>{version.revision}</strong></td>
                    <td><StatusBadge status={version.status} /></td>
                    <td>{formatDateTime(version.createdAt)}<br /><span className="muted">{version.createdBy}</span></td>
                    <td>{formatDateTime(version.activatedAt)}{version.activatedBy ? <><br /><span className="muted">{version.activatedBy}</span></> : null}</td>
                    <td>{version.baseRevision ?? '—'}</td>
                    <td>{version.sourceVersionId ? <span className="source-pill">Откат</span> : '—'}</td>
                    <td><Link className="button button--ghost button--sm button-link" to={`/admin/versions/${version.id}`}><Eye size={16} /> Открыть</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={versions.data.page} totalPages={versions.data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
    </div>
  );
}

function TableSkeleton() {
  return <div className="table-card"><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" /></div>;
}

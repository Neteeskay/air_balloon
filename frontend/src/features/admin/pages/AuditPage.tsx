import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button, EmptyState, ErrorState, Input, Pagination, Skeleton } from '../../../components/ui/primitives';
import type { AuditAction } from '../../../types/admin';
import type { AuditFilters } from '../api/adminApi';
import { useAudit } from '../hooks/useAdminQueries';
import { parseAuditMetadata } from '../utils/audit';
import { formatDateTime } from '../utils/format';

const actions: AuditAction[] = ['CONFIG_CREATED', 'CONFIG_VALIDATED', 'CONFIG_ACTIVATED', 'CONFIG_ROLLBACK', 'ADMIN_LOGIN', 'ADMIN_LOGOUT'];
const initialFilters: AuditFilters = { action: '', administrator: '', version: '', from: '', to: '', page: 0, size: 20 };

function actionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    CONFIG_CREATED: 'Создана конфигурация',
    CONFIG_VALIDATED: 'Проверена конфигурация',
    CONFIG_ACTIVATED: 'Активирована конфигурация',
    CONFIG_ROLLBACK: 'Выполнен откат',
    ADMIN_LOGIN: 'Вход администратора',
    ADMIN_LOGOUT: 'Выход администратора',
  };
  return labels[action];
}

function detailLabel(key: string): string {
  const labels: Record<string, string> = {
    revision: 'Версия',
    previousRevision: 'Предыдущая версия',
    baseRevision: 'Базовая версия',
    sourceVersionId: 'Исходная версия',
    configId: 'Конфигурация',
    gameId: 'Игра',
  };
  return labels[key] ?? 'Параметр';
}

export function AuditPage() {
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const audit = useAudit(filters);

  const applyFilters = () => setFilters({ ...draftFilters, page: 0 });
  const resetFilters = () => { setDraftFilters(initialFilters); setFilters(initialFilters); };
  const changePage = (page: number) => setFilters((current) => ({ ...current, page }));

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><p className="eyebrow">История действий</p><h1>Журнал действий</h1></div>
        <p>Входы, проверки, сохранения, активации и откаты конфигурации.</p>
      </div>

      <section className="filter-card" aria-label="Фильтры журнала действий">
        <div className="filter-grid">
          <label>Действие
            <select className="input" value={draftFilters.action} onChange={(event) => setDraftFilters((current) => ({ ...current, action: event.target.value as AuditAction | '' }))}>
              <option value="">Все действия</option>
              {actions.map((action) => <option key={action} value={action}>{actionLabel(action)}</option>)}
            </select>
          </label>
          <label>Администратор<Input value={draftFilters.administrator} onChange={(event) => setDraftFilters((current) => ({ ...current, administrator: event.target.value }))} placeholder="Имя пользователя" /></label>
          <label>Версия<Input value={draftFilters.version} onChange={(event) => setDraftFilters((current) => ({ ...current, version: event.target.value }))} placeholder="Номер или идентификатор" /></label>
          <label>С даты<Input type="datetime-local" value={draftFilters.from} onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))} /></label>
          <label>По дату<Input type="datetime-local" value={draftFilters.to} onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))} /></label>
        </div>
        <div className="filter-actions">
          <Button variant="primary" onClick={applyFilters}>Применить</Button>
          <Button onClick={resetFilters}><RotateCcw size={16} /> Сбросить</Button>
        </div>
      </section>

      {audit.isLoading ? <div className="table-card"><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" /></div> : null}
      {audit.isError ? <ErrorState error={audit.error} onRetry={() => void audit.refetch()} /> : null}
      {audit.data && audit.data.content.length === 0 ? <EmptyState title="Событий не найдено" description="Измените фильтры или дождитесь новых действий." /> : null}

      {audit.data && audit.data.content.length > 0 ? <>
        <div className="table-card table-scroll">
          <table className="data-table audit-table">
            <thead><tr><th>Время</th><th>Администратор</th><th>Действие</th><th>Конфигурация</th><th>Подробности</th></tr></thead>
            <tbody>
              {audit.data.content.map((entry) => {
                const parsed = parseAuditMetadata(entry.metadata);
                const expanded = expandedId === entry.id;
                return <tr key={entry.id}>
                  <td>{formatDateTime(entry.timestamp)}</td>
                  <td>{entry.administrator}</td>
                  <td>{actionLabel(entry.action)}</td>
                  <td><span className="truncate-code">{entry.configId || '—'}</span></td>
                  <td>
                    {parsed.kind === 'empty' && !entry.traceId ? '—' : <button type="button" className="metadata-toggle" onClick={() => setExpandedId(expanded ? null : entry.id)}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {expanded ? 'Скрыть' : 'Показать'}</button>}
                    {expanded ? <div className="metadata-panel">
                      {parsed.kind === 'json' ? <dl>{parsed.entries.map(([key, value]) => <div key={key}><dt>{detailLabel(key)}</dt><dd>{value}</dd></div>)}</dl> : null}
                      {parsed.kind === 'text' ? <p>{parsed.text}</p> : null}
                      {entry.traceId ? <p className="technical-text">Код обращения: {entry.traceId}</p> : null}
                    </div> : null}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={audit.data.page} totalPages={audit.data.totalPages} onPageChange={changePage} />
      </> : null}
    </div>
  );
}

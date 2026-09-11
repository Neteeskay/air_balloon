import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Dialog, ErrorState, Skeleton, StatusBadge } from '../../../components/ui/primitives';
import { useToast } from '../../../components/ui/toast';
import { ApiError } from '../../../services/apiClient';
import { adminApi } from '../api/adminApi';
import { adminKeys } from '../api/queryKeys';
import { DiffTable } from '../components/DiffTable';
import { ReadonlyConfig } from '../components/ReadonlyConfig';
import { useConfigMetadata, useCurrentConfig, useVersion, useVersionDiff } from '../hooks/useAdminQueries';
import { mapApiError } from '../model/errorMessages';
import { formatDateTime } from '../utils/format';

export function VersionDetailPage() {
  const { id = '' } = useParams();
  const versionQuery = useVersion(id);
  const currentQuery = useCurrentConfig();
  const metadataQuery = useConfigMetadata();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [showActivate, setShowActivate] = useState(false);
  const [showRollback, setShowRollback] = useState(false);
  const [actionError, setActionError] = useState<ReturnType<typeof mapApiError> | null>(null);
  const [conflict, setConflict] = useState<ApiError | null>(null);

  const version = versionQuery.data;
  const current = currentQuery.data;
  const diffQuery = useVersionDiff(current?.id ?? '', version?.id ?? '', Boolean(current && version && current.id !== version.id));

  const activateMutation = useMutation({ mutationFn: (versionId: string) => adminApi.activate(versionId) });
  const rollbackMutation = useMutation({ mutationFn: (versionId: string) => adminApi.rollback(versionId) });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.current() }),
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'versions'] }),
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'audit'] }),
      queryClient.invalidateQueries({ queryKey: adminKeys.version(id) }),
    ]);
  };

  const activate = async () => {
    if (!version) return;
    try {
      const result = await activateMutation.mutateAsync(version.id);
      setShowActivate(false);
      await refresh();
      showToast(`Версия ${result.revision} активирована.`, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFIG_VERSION_CONFLICT') setConflict(error);
      setActionError(mapApiError(error));
      setShowActivate(false);
    }
  };

  const rollback = async () => {
    if (!version) return;
    try {
      const result = await rollbackMutation.mutateAsync(version.id);
      setShowRollback(false);
      await refresh();
      showToast(`Создан откат: активна новая версия ${result.revision}.`, 'success');
      navigate(`/admin/versions/${result.id}`);
    } catch (error) {
      setActionError(mapApiError(error));
      setShowRollback(false);
    }
  };

  if (versionQuery.isLoading || currentQuery.isLoading || metadataQuery.isLoading) {
    return <div className="page-stack"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-card" /><Skeleton className="skeleton-form" /></div>;
  }
  if (versionQuery.isError) return <ErrorState error={versionQuery.error} onRetry={() => void versionQuery.refetch()} />;
  if (currentQuery.isError) return <ErrorState error={currentQuery.error} onRetry={() => void currentQuery.refetch()} />;
  if (metadataQuery.isError) return <ErrorState error={metadataQuery.error} onRetry={() => void metadataQuery.refetch()} />;
  if (!version || !current) return null;

  return (
    <div className="page-stack">
      <Link to="/admin/versions" className="back-link"><ArrowLeft size={16} /> К истории версий</Link>

      <div className="page-heading page-heading--actions">
        <div>
          <p className="eyebrow">Сохранённая конфигурация</p>
          <div className="heading-status"><h1>Версия {version.revision}</h1><StatusBadge status={version.status} /></div>
        </div>
        <div className="page-actions">
          {version.status === 'DRAFT' ? <Button variant="primary" onClick={() => setShowActivate(true)}><Zap size={17} /> Активировать</Button> : null}
          {version.status === 'ARCHIVED' ? <Button variant="primary" onClick={() => setShowRollback(true)}><RotateCcw size={17} /> Выполнить откат</Button> : null}
        </div>
      </div>

      {actionError ? <Alert title={actionError.title} tone="danger"><p>{actionError.message}</p>{actionError.traceId ? <p className="technical-text">Код обращения: {actionError.traceId}</p> : null}</Alert> : null}

      <Card>
        <h2>Сведения о версии</h2>
        <dl className="summary-list">
          <div><dt>Создана</dt><dd>{formatDateTime(version.createdAt)}</dd></div>
          <div><dt>Создал</dt><dd>{version.createdBy}</dd></div>
          <div><dt>Активирована</dt><dd>{formatDateTime(version.activatedAt)}</dd></div>
          <div><dt>Активировал</dt><dd>{version.activatedBy || '—'}</dd></div>
          <div><dt>Базовая версия</dt><dd>{version.baseRevision ?? '—'}</dd></div>
          <div><dt>Идентификатор</dt><dd><span className="truncate-code">{version.id}</span></dd></div>
        </dl>
      </Card>

      {version.id !== current.id ? (
        <Card>
          <div className="card-heading-row"><div><p className="eyebrow">Сравнение</p><h2>Активная версия {current.revision} → версия {version.revision}</h2></div></div>
          {diffQuery.isLoading ? <Skeleton className="skeleton-form" /> : null}
          {diffQuery.isError ? <ErrorState error={diffQuery.error} onRetry={() => void diffQuery.refetch()} /> : null}
          {diffQuery.data ? <DiffTable diff={diffQuery.data} metadata={metadataQuery.data} /> : null}
        </Card>
      ) : <Alert title="Это текущая активная конфигурация" tone="success" />}

      <Card><ReadonlyConfig config={version} metadata={metadataQuery.data} /></Card>

      <Dialog
        open={showActivate}
        onOpenChange={setShowActivate}
        title={`Активировать версию ${version.revision}?`}
        description="Черновик станет активной конфигурацией, а предыдущая версия будет перенесена в архив."
        footer={<><Button onClick={() => setShowActivate(false)}>Отмена</Button><Button variant="primary" disabled={activateMutation.isPending} onClick={() => void activate()}>{activateMutation.isPending ? 'Активируем…' : 'Активировать версию'}</Button></>}
      >
        <Alert title="Изменения затронут только новые раунды" tone="info">Уже запущенные раунды сохранят прежнюю конфигурацию.</Alert>
        {diffQuery.data ? <DiffTable diff={diffQuery.data} metadata={metadataQuery.data} /> : null}
      </Dialog>

      <Dialog
        open={Boolean(conflict)}
        onOpenChange={(open) => { if (!open) setConflict(null); }}
        title="Конфигурация уже была изменена другим администратором"
        description={conflict?.currentVersion ? `Текущая версия на сервере — ${conflict.currentVersion}.` : undefined}
        footer={
          <>
            <Button onClick={() => setConflict(null)}>Отмена</Button>
            <Button variant="primary" onClick={() => { setConflict(null); setActionError(null); void refresh(); }}>Загрузить актуальные данные</Button>
          </>
        }
      >
        <p>Автоматическая перезапись не выполняется. После обновления повторите действие вручную.</p>
        {conflict?.traceId ? <p className="technical-text">Код обращения: {conflict.traceId}</p> : null}
      </Dialog>

      <Dialog
        open={showRollback}
        onOpenChange={setShowRollback}
        title={`Создать новую версию на основе версии ${version.revision}?`}
        description={`Сейчас активна версия ${current.revision}. История изменений сохранится.`}
        footer={<><Button onClick={() => setShowRollback(false)}>Отмена</Button><Button variant="primary" disabled={rollbackMutation.isPending} onClick={() => void rollback()}>{rollbackMutation.isPending ? 'Создаём…' : 'Создать и активировать'}</Button></>}
      >
        <p>Будет создана новая активная конфигурация со значениями выбранной версии.</p>
        {diffQuery.data ? <DiffTable diff={diffQuery.data} metadata={metadataQuery.data} /> : null}
      </Dialog>
    </div>
  );
}

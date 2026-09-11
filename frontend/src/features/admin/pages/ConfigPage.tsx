import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, type FieldPath, useForm } from 'react-hook-form';
import { useBlocker } from 'react-router-dom';
import {
  Alert,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui/primitives';
import { useToast } from '../../../components/ui/toast';
import { ApiError } from '../../../services/apiClient';
import type {
  ConfigMetadataResponse,
  GameConfigurationCandidateRequest,
  GameConfigurationResponse,
} from '../../../types/admin';
import { adminApi } from '../api/adminApi';
import { adminKeys } from '../api/queryKeys';
import { ChangeSummary } from '../components/ChangeSummary';
import {
  BoosterFields,
  CrashFields,
  GeneralFields,
  PointsFields,
} from '../configuration/ConfigFields';
import { useConfigMetadata, useCurrentConfig } from '../hooks/useAdminQueries';
import {
  buildCandidateRequest,
  getChangeSummary,
  toEditableConfig,
  type EditableConfigModel,
} from '../model/configModel';
import { mapApiError } from '../model/errorMessages';

function candidateFromResponse(config: GameConfigurationResponse): GameConfigurationCandidateRequest {
  return {
    revision: config.baseRevision ?? config.revision,
    gameId: config.gameId,
    gameName: config.gameName,
    gameType: config.gameType,
    isActive: config.isActive,
    crash: config.crash,
    boosters: config.boosters,
    points: config.points,
  };
}

function applyServerFieldErrors(
  error: ApiError,
  setError: (name: FieldPath<EditableConfigModel>, error: { type: string; message: string }) => void,
): boolean {
  const fieldErrors = error.fieldErrors;
  if (!fieldErrors) return false;
  let applied = false;
  if (Array.isArray(fieldErrors)) {
    fieldErrors.forEach((item) => {
      if (item?.field && item.message) {
        setError(item.field as FieldPath<EditableConfigModel>, { type: 'server', message: item.message });
        applied = true;
      }
    });
  } else {
    Object.entries(fieldErrors).forEach(([field, message]) => {
      if (typeof message === 'string') {
        setError(field as FieldPath<EditableConfigModel>, { type: 'server', message });
        applied = true;
      }
    });
  }
  return applied;
}

function ConfigSkeleton() {
  return (
    <div className="page-stack">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-tabs" />
      <Skeleton className="skeleton-form" />
    </div>
  );
}

export function ConfigPage() {
  const currentQuery = useCurrentConfig();
  const metadataQuery = useConfigMetadata();

  if (currentQuery.isLoading || metadataQuery.isLoading) return <ConfigSkeleton />;
  if (currentQuery.error instanceof ApiError && currentQuery.error.status === 404) {
    return (
      <EmptyState
        title="Нет активной конфигурации"
        description="Редактирование станет доступно после появления активной конфигурации."
      />
    );
  }
  if (currentQuery.isError) return <ErrorState error={currentQuery.error} onRetry={() => void currentQuery.refetch()} />;
  if (metadataQuery.isError) return <ErrorState error={metadataQuery.error} onRetry={() => void metadataQuery.refetch()} />;
  if (!currentQuery.data || !metadataQuery.data) return null;

  return <ConfigEditor current={currentQuery.data} metadata={metadataQuery.data} refetchCurrent={currentQuery.refetch} />;
}

function ConfigEditor({
  current,
  metadata,
  refetchCurrent,
}: {
  current: GameConfigurationResponse;
  metadata: ConfigMetadataResponse;
  refetchCurrent: () => Promise<unknown>;
}) {
  const form = useForm<EditableConfigModel>({
    defaultValues: toEditableConfig(current),
    mode: 'onBlur',
    shouldUnregister: false,
  });
  const { formState, trigger, getValues, reset, setError, clearErrors, watch } = form;
  const watchedValues = watch();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generalError, setGeneralError] = useState<ReturnType<typeof mapApiError> | null>(null);
  const [draft, setDraft] = useState<GameConfigurationResponse | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [conflict, setConflict] = useState<ApiError | null>(null);
  const [validatedSignature, setValidatedSignature] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const blocker = useBlocker(formState.isDirty);

  useEffect(() => {
    if (!formState.isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [formState.isDirty]);

  const candidate = useMemo(() => {
    try {
      return buildCandidateRequest(watchedValues, current.revision);
    } catch {
      return null;
    }
  }, [current.revision, watchedValues]);

  const candidateSignature = candidate ? JSON.stringify(candidate) : null;
  const validationIsCurrent = validatedSignature !== null && validatedSignature === candidateSignature;

  const changes = useMemo(
    () => (candidate ? getChangeSummary(current, candidate, metadata) : []),
    [candidate, current, metadata],
  );

  const draftChanges = useMemo(
    () => (draft ? getChangeSummary(current, candidateFromResponse(draft), metadata) : []),
    [current, draft, metadata],
  );

  const invalidateChangedData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.current() }),
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'versions'] }),
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'audit'] }),
    ]);
  };

  const validationMutation = useMutation({ mutationFn: (request: GameConfigurationCandidateRequest) => adminApi.validate(request) });
  const saveMutation = useMutation({ mutationFn: (request: GameConfigurationCandidateRequest) => adminApi.createDraft(request) });
  const activateMutation = useMutation({ mutationFn: (id: string) => adminApi.activate(id) });

  const buildValidatedCandidate = async (): Promise<GameConfigurationCandidateRequest | null> => {
    clearErrors();
    setGeneralError(null);
    setWarnings([]);
    setValidatedSignature(null);
    const locallyValid = await trigger();
    if (!locallyValid) return null;
    let next: GameConfigurationCandidateRequest;
    try {
      next = buildCandidateRequest(getValues(), current.revision);
    } catch {
      setGeneralError({ title: 'Проверьте числа', message: 'Одно или несколько числовых полей заполнены некорректно.' });
      return null;
    }
    try {
      const result = await validationMutation.mutateAsync(next);
      setWarnings(result.warnings ?? []);
      if (!result.valid) {
        setGeneralError({ title: 'Конфигурация не прошла проверку', message: 'Исправьте значения и повторите проверку.' });
        return null;
      }
      setValidatedSignature(JSON.stringify(next));
      return next;
    } catch (error) {
      if (error instanceof ApiError) {
        applyServerFieldErrors(error, setError);
        if (error.code === 'CONFIG_VERSION_CONFLICT') setConflict(error);
      }
      setGeneralError(mapApiError(error));
      return null;
    }
  };

  const handleValidate = async () => {
    const next = await buildValidatedCandidate();
    if (next) showToast('Проверка пройдена.', 'success');
  };

  const handleSave = async () => {
    const next = await buildValidatedCandidate();
    if (!next) return;
    try {
      const created = await saveMutation.mutateAsync(next);
      setDraft(created);
      reset(getValues());
      await invalidateChangedData();
      showToast(`Черновик версии ${created.revision} создан.`, 'success');
    } catch (error) {
      if (error instanceof ApiError) {
        applyServerFieldErrors(error, setError);
        if (error.code === 'CONFIG_VERSION_CONFLICT') setConflict(error);
      }
      setGeneralError(mapApiError(error));
    }
  };

  const handleActivate = async () => {
    if (!draft) return;
    try {
      const activated = await activateMutation.mutateAsync(draft.id);
      setShowActivate(false);
      setDraft(null);
      setWarnings([]);
      setValidatedSignature(null);
      reset(toEditableConfig(activated));
      await invalidateChangedData();
      showToast(`Версия ${activated.revision} активирована.`, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFIG_VERSION_CONFLICT') setConflict(error);
      setGeneralError(mapApiError(error));
      setShowActivate(false);
    }
  };

  const reloadAfterConflict = async () => {
    const result = await refetchCurrent();
    const data = (result as { data?: GameConfigurationResponse }).data;
    if (data) {
      reset(toEditableConfig(data));
      setDraft(null);
      setWarnings([]);
      setGeneralError(null);
      setConflict(null);
      showToast(`Загружена актуальная версия ${data.revision}.`, 'info');
    }
  };

  return (
    <FormProvider {...form}>
      <div className="page-stack">
        <div className="page-heading page-heading--actions">
          <div>
            <p className="eyebrow">Активная версия {current.revision}</p>
            <h1>Конфигурация</h1>
            <p>Сначала проверьте изменения, затем сохраните черновик и активируйте его.</p>
          </div>
          <div className="page-actions">
            <Button
              onClick={() => reset(toEditableConfig(current))}
              disabled={!formState.isDirty || saveMutation.isPending}
            >
              <RotateCcw size={17} /> Сбросить
            </Button>
            <Button onClick={() => setShowChanges(true)} disabled={changes.length === 0}>
              Изменения · {changes.length}
            </Button>
          </div>
        </div>

        {generalError ? (
          <Alert title={generalError.title} tone="danger">
            <p>{generalError.message}</p>
            
            {generalError.traceId ? <p className="technical-text">Код обращения: {generalError.traceId}</p> : null}
          </Alert>
        ) : null}

        {validationIsCurrent && warnings.length > 0 ? (
          <Alert title="Проверка вернула предупреждения" tone="warning">
            <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </Alert>
        ) : null}

        {validationIsCurrent ? (
          <Alert title="Проверка пройдена" tone="success">
            Сервер подтвердил значения. При сохранении проверка будет выполнена ещё раз.
          </Alert>
        ) : null}

        {draft ? (
          <Alert
            title={`Черновик версии ${draft.revision} создан`}
            tone="warning"
            actions={
              <Button variant="primary" onClick={() => setShowActivate(true)} disabled={activateMutation.isPending}>
                Активировать версию
              </Button>
            }
          >
            <p>Текущая активная версия {current.revision} пока не изменена.</p>
            {formState.isDirty ? <p>После сохранения черновика появились новые изменения — они в него не входят.</p> : null}
          </Alert>
        ) : null}

        <Tabs defaultValue="general" className="config-tabs">
          <TabsList className="tabs-list" aria-label="Разделы конфигурации">
            <TabsTrigger value="general" className="tabs-trigger">Основные</TabsTrigger>
            <TabsTrigger value="crash" className="tabs-trigger">Модель коэффициента</TabsTrigger>
            <TabsTrigger value="boosters" className="tabs-trigger">Бустеры</TabsTrigger>
            <TabsTrigger value="points" className="tabs-trigger">Очки</TabsTrigger>
          </TabsList>
          <div className="config-panel">
            <TabsContent value="general" className="tabs-content">
              <SectionHeader title="Основные настройки" description="Идентификация игры и возможность создания новых раундов." />
              <GeneralFields metadata={metadata} />
            </TabsContent>
            <TabsContent value="crash" className="tabs-content">
              <SectionHeader title="Модель коэффициента" description="Распределение результата и динамика роста коэффициента." />
              <CrashFields metadata={metadata} />
            </TabsContent>
            <TabsContent value="boosters" className="tabs-content">
              <SectionHeader title="Бустеры" description="Сила бустера и линии, на которых он может появиться." />
              <BoosterFields metadata={metadata} current={current} />
            </TabsContent>
            <TabsContent value="points" className="tabs-content">
              <SectionHeader title="Очки" description="Начисление очков за уровень, завершение раунда и активацию бустера." />
              <PointsFields metadata={metadata} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="sticky-actions" aria-label="Действия с конфигурацией">
          <div>
            <strong>{formState.isDirty ? `Есть несохранённые изменения: ${changes.length}` : 'Локальных изменений нет'}</strong>
            <span>Исходная активная версия: {current.revision}</span>
          </div>
          <div className="sticky-actions__buttons">
            <Button onClick={() => void handleValidate()} disabled={validationMutation.isPending}>
              <ShieldCheck size={17} /> {validationMutation.isPending ? 'Проверяем…' : 'Проверить'}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={!formState.isDirty || saveMutation.isPending}>
              <Save size={17} /> {saveMutation.isPending ? 'Сохраняем…' : 'Сохранить черновик'}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showChanges} onOpenChange={setShowChanges} title="Изменения относительно активной версии" description={`Сравнение с версией ${current.revision}.`}>
        <ChangeSummary changes={changes} />
      </Dialog>

      <Dialog
        open={showActivate}
        onOpenChange={setShowActivate}
        title="Активировать версию?"
        description={draft ? `Черновик версии ${draft.revision} станет новой активной конфигурацией.` : undefined}
        footer={
          <>
            <Button onClick={() => setShowActivate(false)}>Отмена</Button>
            <Button variant="primary" onClick={() => void handleActivate()} disabled={activateMutation.isPending}>
              {activateMutation.isPending ? 'Активируем…' : 'Активировать версию'}
            </Button>
          </>
        }
      >
        <Alert title="Изменения затронут только новые раунды" tone="info">
          Уже запущенные раунды сохраняют свою версию конфигурации.
        </Alert>
        <ChangeSummary changes={draftChanges} />
      </Dialog>

      <Dialog
        open={Boolean(conflict)}
        onOpenChange={(open) => { if (!open) setConflict(null); }}
        title="Конфигурация уже была изменена другим администратором"
        description={conflict?.currentVersion ? `Текущая версия на сервере — ${conflict.currentVersion}.` : undefined}
        footer={
          <>
            <Button onClick={() => setConflict(null)}>Отмена</Button>
            <Button variant="primary" onClick={() => void reloadAfterConflict()}>Загрузить актуальную конфигурацию</Button>
          </>
        }
      >
        <p>Автоматическое слияние и повторная отправка не выполняются. После загрузки актуальной версии изменения нужно применить заново.</p>
        {conflict?.traceId ? <p className="technical-text">Код обращения: {conflict.traceId}</p> : null}
      </Dialog>

      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => { if (!open && blocker.state === 'blocked') blocker.reset(); }}
        title="Есть несохранённые изменения"
        description="Если уйти со страницы, локальные изменения будут потеряны."
        footer={
          <>
            <Button onClick={() => blocker.state === 'blocked' && blocker.reset()}>Остаться</Button>
            <Button variant="danger" onClick={() => blocker.state === 'blocked' && blocker.proceed()}>Уйти без сохранения</Button>
          </>
        }
      >
        <div className="dialog-warning"><AlertCircle size={20} /><span>Сохраните черновик или сбросьте изменения перед переходом.</span></div>
      </Dialog>
    </FormProvider>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <div className="section-header"><div><h2>{title}</h2><p>{description}</p></div><CheckCircle2 size={20} aria-hidden="true" /></div>;
}


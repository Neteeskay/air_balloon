import type { FieldPath } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { Alert, FormField, Input, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/primitives';
import type { ConfigMetadataResponse, ConfigParameterMetadata, GameConfigurationResponse } from '../../../types/admin';
import {
  getProbabilityKeys,
  isNormalizedProbabilityModel,
  parseDecimalInput,
  probabilitySummary,
  type EditableConfigModel,
} from '../model/configModel';

const labels: Record<string, string> = {
  gameId: 'Идентификатор игры',
  gameName: 'Название игры',
  gameType: 'Тип игры',
  isActive: 'Новые раунды разрешены',
  'crash.alpha': 'Преимущество системы',
  'crash.maxMultiplier': 'Максимальный коэффициент',
  'crash.minCrashMultiplier': 'Минимальный коэффициент завершения',
  'crash.multiplierGrowthRate': 'Скорость роста коэффициента',
  'crash.fps': 'Частота обновления',
  'crash.delta': 'Шаг изменения коэффициента',
  'boosters.multiplierTier1Value': 'Множитель 1',
  'boosters.multiplierTier2Value': 'Множитель 2',
  'boosters.multiplierTier3Value': 'Множитель 3',
  'boosters.multiplierTier4Value': 'Множитель 4',
  'points.pointsPerLine': 'Очки за прохождение уровня',
  'points.pointsCashoutBonus': 'Бонус за досрочное завершение',
  'points.pointsXNBonus': 'Бонус за активацию бустера',
};

const descriptions: Record<string, string> = {
  gameId: 'Системный идентификатор игры. Обычно он недоступен для изменения.',
  gameName: 'Название, которое используется для этой игры.',
  gameType: 'Тип игровой механики.',
  isActive: 'Если выключить параметр, новые игровые раунды нельзя будет создавать.',
  'crash.alpha': 'Параметр распределения результата. Точное допустимое значение задаётся сервером.',
  'crash.maxMultiplier': 'Верхняя граница коэффициента.',
  'crash.minCrashMultiplier': 'Нижняя граница коэффициента завершения.',
  'crash.multiplierGrowthRate': 'Определяет скорость визуального роста коэффициента.',
  'crash.fps': 'Количество обновлений отображения за секунду.',
  'crash.delta': 'Шаг, с которым изменяется отображаемый коэффициент.',
  'points.pointsPerLine': 'Количество очков за каждый пройденный уровень.',
  'points.pointsCashoutBonus': 'Дополнительные очки за успешное досрочное завершение раунда.',
  'points.pointsXNBonus': 'Дополнительные очки при срабатывании бустера.',
};

function metadataFor(name: string, metadata?: ConfigMetadataResponse): ConfigParameterMetadata | undefined {
  return metadata?.parameters.find((item) => item.technicalName === name);
}

function labelFor(name: string): string {
  if (labels[name]) return labels[name];
  const level = name.match(/line(\d+)/i)?.[1];
  if (level) return `Линия ${level}`;
  return 'Параметр';
}

function descriptionFor(name: string): string | null {
  return descriptions[name] || null;
}

function rangeText(meta?: ConfigParameterMetadata): string | null {
  if (meta?.min != null && meta.max != null) return `От ${meta.min} до ${meta.max}`;
  if (meta?.min != null) return `Не меньше ${meta.min}`;
  if (meta?.max != null) return `Не больше ${meta.max}`;
  return null;
}

type NumericPath =
  | 'crash.alpha'
  | 'crash.maxMultiplier'
  | 'crash.minCrashMultiplier'
  | 'crash.multiplierGrowthRate'
  | 'crash.fps'
  | 'crash.delta'
  | 'boosters.multiplierTier1Value'
  | 'boosters.multiplierTier2Value'
  | 'boosters.multiplierTier3Value'
  | 'boosters.multiplierTier4Value'
  | 'points.pointsPerLine'
  | 'points.pointsCashoutBonus'
  | 'points.pointsXNBonus'
  | `boosters.green.${string}`
  | `boosters.red.${string}`;

export function ConfigNumberField({
  name,
  technicalName = name,
  metadata,
  label,
  description,
}: {
  name: NumericPath;
  technicalName?: string;
  metadata?: ConfigMetadataResponse;
  label?: string;
  description?: string | null;
}) {
  const { register, getFieldState } = useFormContext<EditableConfigModel>();
  const meta = metadataFor(technicalName, metadata);
  const fieldName = name as FieldPath<EditableConfigModel>;
  const error = getFieldState(fieldName).error?.message;
  const disabled = meta?.mutable === false;
  const inputId = `field-${technicalName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const registration = register(fieldName, {
    validate: (raw) => {
      if (typeof raw !== 'string') return 'Введите число';
      if (!raw.trim()) return meta?.required === false ? true : 'Обязательное поле';
      let value: number;
      try {
        value = parseDecimalInput(raw);
      } catch {
        return 'Введите корректное число';
      }
      if (meta?.dataType?.toUpperCase().includes('INTEGER') && !Number.isInteger(value)) return 'Нужно целое число';
      if (meta?.min != null && value < meta.min) return `Минимальное значение: ${meta.min}`;
      if (meta?.max != null && value > meta.max) return `Максимальное значение: ${meta.max}`;
      return true;
    },
  });

  return (
    <FormField
      label={label ?? labelFor(technicalName)}
      description={description ?? descriptionFor(technicalName)}
      required={meta?.required}
      error={error}
      htmlFor={inputId}
      errorId={`${inputId}-error`}
    >
      <Input
        id={inputId}
        inputMode="decimal"
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...registration}
      />
      <div className="field-meta-row">
        {rangeText(meta) ? <small>{rangeText(meta)}</small> : <span />}
        {disabled ? <small>Только просмотр</small> : null}
      </div>
    </FormField>
  );
}

export function GeneralFields({ metadata }: { metadata?: ConfigMetadataResponse }) {
  const { register, watch, setValue, getFieldState } = useFormContext<EditableConfigModel>();
  const active = watch('isActive');
  const activeMeta = metadataFor('isActive', metadata);

  return (
    <div className="form-grid">
      {(['gameId', 'gameName', 'gameType'] as const).map((name) => {
        const meta = metadataFor(name, metadata);
        const error = getFieldState(name).error?.message;
        return (
          <FormField
            key={name}
            label={labelFor(name)}
            description={descriptionFor(name)}
            required={meta?.required}
            error={error}
            htmlFor={`field-${name}`}
            errorId={`field-${name}-error`}
          >
            {meta?.allowedValues && meta.allowedValues.length > 0 ? (
              <select
                id={`field-${name}`}
                className="input"
                disabled={meta.mutable === false}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `field-${name}-error` : undefined}
                {...register(name, { required: meta.required === false ? false : 'Обязательное поле' })}
              >
                {meta.allowedValues.map((value) => <option key={String(value)} value={String(value)}>{name === 'gameType' && String(value) === 'CRASH' ? 'Игра с растущим коэффициентом' : String(value)}</option>)}
              </select>
            ) : (
              name === 'gameType' ? (
                <>
                  <input type="hidden" {...register(name, { required: meta?.required === false ? false : 'Обязательное поле' })} />
                  <Input id={`field-${name}`} value="Игра с растущим коэффициентом" disabled readOnly />
                </>
              ) : (
                <Input
                  id={`field-${name}`}
                  disabled={meta?.mutable === false}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `field-${name}-error` : undefined}
                  {...register(name, { required: meta?.required === false ? false : 'Обязательное поле' })}
                />
              )
            )}
            <div className="field-meta-row">
              <span />
              {meta?.mutable === false ? <small>Только просмотр</small> : null}
            </div>
          </FormField>
        );
      })}

      <FormField label={labelFor('isActive')} description={descriptionFor('isActive')}>
        <div className="switch-row">
          <Switch
            checked={active}
            disabled={activeMeta?.mutable === false}
            ariaLabel="Разрешить новые игровые раунды"
            onCheckedChange={(checked) => setValue('isActive', checked, { shouldDirty: true })}
          />
          <div>
            <strong>{active ? 'Игра включена' : 'Игра отключена'}</strong>
            <span>{active ? 'Новые раунды доступны.' : 'Новые раунды недоступны.'}</span>
          </div>
        </div>
      </FormField>

      {!active ? (
        <Alert title="Новые раунды будут недоступны" tone="warning">
          Уже запущенные раунды продолжат работать со своей сохранённой конфигурацией.
        </Alert>
      ) : null}
    </div>
  );
}

export function CrashFields({ metadata }: { metadata?: ConfigMetadataResponse }) {
  return (
    <div className="form-grid">
      <ConfigNumberField name="crash.alpha" metadata={metadata} />
      <ConfigNumberField name="crash.maxMultiplier" metadata={metadata} />
      <ConfigNumberField name="crash.minCrashMultiplier" metadata={metadata} />
      <ConfigNumberField name="crash.multiplierGrowthRate" metadata={metadata} />
      <ConfigNumberField name="crash.fps" metadata={metadata} />
      <ConfigNumberField name="crash.delta" metadata={metadata} />
    </div>
  );
}

export function PointsFields({ metadata }: { metadata?: ConfigMetadataResponse }) {
  return (
    <div className="form-grid">
      <ConfigNumberField name="points.pointsPerLine" metadata={metadata} />
      <ConfigNumberField name="points.pointsCashoutBonus" metadata={metadata} />
      <ConfigNumberField name="points.pointsXNBonus" metadata={metadata} />
    </div>
  );
}

export function BoosterFields({
  metadata,
  current,
}: {
  metadata?: ConfigMetadataResponse;
  current: GameConfigurationResponse;
}) {
  return (
    <div className="booster-stack">
      <section className="booster-section">
        <div className="subsection-heading subsection-heading--compact">
          <div>
            <h3>Множитель бустера</h3>
            <p>Четыре варианта силы бустера. Номер множителя не связан с номером линии.</p>
          </div>
        </div>
        <div className="tier-grid tier-grid--compact">
          <ConfigNumberField name="boosters.multiplierTier1Value" metadata={metadata} label="Множитель 1" description={null} />
          <ConfigNumberField name="boosters.multiplierTier2Value" metadata={metadata} label="Множитель 2" description={null} />
          <ConfigNumberField name="boosters.multiplierTier3Value" metadata={metadata} label="Множитель 3" description={null} />
          <ConfigNumberField name="boosters.multiplierTier4Value" metadata={metadata} label="Множитель 4" description={null} />
        </div>
      </section>

      <section className="booster-section">
        <div className="subsection-heading subsection-heading--compact">
          <div>
            <h3>Где появляется бустер</h3>
            <p>Чем больше вес линии, тем чаще сервер выбирает её для появления бустера.</p>
          </div>
        </div>
        <Tabs defaultValue="green" className="booster-theme-tabs">
          <TabsList className="tabs-list" aria-label="Вариант поля">
            <TabsTrigger value="green" className="tabs-trigger">Зелёное поле · 9 линий</TabsTrigger>
            <TabsTrigger value="red" className="tabs-trigger">Красное поле · 12 линий</TabsTrigger>
          </TabsList>
          <TabsContent value="green" className="tabs-content booster-theme-content">
            <ProbabilityTheme theme="green" metadata={metadata} current={current} />
          </TabsContent>
          <TabsContent value="red" className="tabs-content booster-theme-content">
            <ProbabilityTheme theme="red" metadata={metadata} current={current} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function ProbabilityTheme({
  theme,
  metadata,
  current,
}: {
  theme: 'green' | 'red';
  metadata?: ConfigMetadataResponse;
  current: GameConfigurationResponse;
}) {
  const { watch } = useFormContext<EditableConfigModel>();
  const expectedCount = theme === 'green' ? 9 : 12;
  const reportedCount = theme === 'green' ? metadata?.greenLevelCount : metadata?.redLevelCount;
  const keys = getProbabilityKeys(theme, current, metadata);
  const values = watch(`boosters.${theme}`) as Record<string, string>;
  const sum = probabilitySummary(values);
  const normalized = isNormalizedProbabilityModel(metadata?.probabilityModel);
  const probabilityMeta = metadata?.parameters.filter((item) => item.technicalName.startsWith(`boosters.${theme}.`)) ?? [];
  const hasCompleteScaleMetadata = probabilityMeta.length > 0 && probabilityMeta.every((item) => item.max != null);
  const normalizedTarget = normalized && hasCompleteScaleMetadata
    ? probabilityMeta.every((item) => (item.max ?? Number.POSITIVE_INFINITY) <= 1) ? 1 : 100
    : null;

  return (
    <section className="probability-card">
      <div className="card-heading-row">
        <div>
          <h3>{normalized ? 'Вероятность появления' : 'Вес появления'}</h3>
        </div>
        <span className="count-pill">{expectedCount} линий</span>
      </div>

      <div className="probability-summary">
        <span>{normalized ? 'Сумма вероятностей' : 'Сумма весов'} <strong>{sum == null ? '—' : sum}</strong></span>
      </div>

      {normalizedTarget != null && sum != null && Math.abs(sum - normalizedTarget) > 0.000001 ? (
        <Alert title={`Сумма должна быть ${normalizedTarget}`} tone="warning">
          Проверьте значения перед сохранением.
        </Alert>
      ) : null}

      {reportedCount != null && reportedCount !== expectedCount ? (
        <Alert title="Количество линий отличается от ожидаемого" tone="warning">
          Сервер сообщил другое количество линий. Поля будут показаны только там, где известна их схема.
        </Alert>
      ) : null}

      {keys.length !== expectedCount ? (
        <Alert title="Часть линий недоступна" tone="warning">
          Не все поля описаны текущей конфигурацией или метаданными.
        </Alert>
      ) : null}

      <div className="probability-grid">
        {Array.from({ length: expectedCount }, (_, index) => {
          const key = keys[index];
          if (!key) {
            return (
              <div className="probability-cell probability-cell--missing" key={`missing-${index}`}>
                <span>Линия {index + 1}</span>
                <span>Нет данных</span>
              </div>
            );
          }
          const technicalName = `boosters.${theme}.${key}`;
          return (
            <div className="probability-cell" key={key}>
              <span className="probability-level">Линия {index + 1}</span>
              <ConfigNumberField
                name={`boosters.${theme}.${key}` as NumericPath}
                technicalName={technicalName}
                metadata={metadata}
                label={`Линия ${index + 1}`}
                description={null}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LineChart } from '../chart'
import { AdminClient, AdminApiError } from '../client'
import { HelpPopover } from '../components'
import { CRASH_PARAM_HELP } from '../help'
import { survival, theoreticalCurve } from '../math'
import { assemble, EditorModel, flatten, formParameters, themeSum } from '../model'
import type { ConfigMetadata, FieldViolation, GameConfiguration, GameConfigurationWrite, ParameterMetadata, ValidationResult } from '../types'
import { formatValue } from '../format'

type Flash = { type: 'info' | 'error' | 'warning'; message: string; details?: string }

const equalModel = (a: EditorModel, b: EditorModel) => {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every(key => a[key] === b[key])
}

const toNumber = (model: EditorModel, name: string, fallback: number) => {
  const raw = model[name]
  if (raw === '' || raw === undefined) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function ConfigEditor({ client, metadata }: { client: AdminClient; metadata: ConfigMetadata }) {
  const [current, setCurrent] = useState<GameConfiguration | null>(null)
  const [model, setModel] = useState<EditorModel>({})
  const [savedSnapshot, setSavedSnapshot] = useState<EditorModel | null>(null)
  const [draft, setDraft] = useState<GameConfiguration | null>(null)
  const [busyAction, setBusyAction] = useState<'validate' | 'save' | 'activate' | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldViolation[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [conflictVersion, setConflictVersion] = useState<number | null>(null)
  const [loadError, setLoadError] = useState('')
  const [boosterTheme, setBoosterTheme] = useState<'green' | 'red'>('green')
  const reload = useCallback(() => {
    client.getCurrent()
      .then(config => {
        const flat = flatten(config, metadata)
        setCurrent(config); setModel(flat); setSavedSnapshot(flat)
        setDraft(null); setFieldErrors([]); setWarnings([]); setConflictVersion(null)
      })
      .catch(e => setLoadError((e as Error).message))
  }, [client, metadata])
  useEffect(() => { reload() }, [reload])
  const nextRevision = current ? current.revision + 1 : 0
  const draftStale = draft !== null && (savedSnapshot === null || !equalModel(model, savedSnapshot))
  const setField = useCallback((name: string, value: string) => setModel(prev => ({ ...prev, [name]: value })), [])
  const assembleDraft = useCallback((): GameConfigurationWrite => {
    if (!current) throw new Error('Конфигурация не загружена')
    return assemble(model, current, nextRevision)
  }, [model, current, nextRevision])
  const handleFlash = (flash: Flash) => { setFlash(flash); setTimeout(() => setFlash(null), 12_000) }
  const assembleBody = useCallback(async () => {
    const body = assembleDraft()
    const result: ValidationResult = await client.validate(body)
    setFieldErrors([]); setWarnings(result.warnings)
    return { body, result }
  }, [assembleDraft, client])
  const validate = useCallback(async () => {
    if (!current) return
    setBusyAction('validate'); setFieldErrors([]); setWarnings([])
    try {
      const { result } = await assembleBody()
      if (result.valid) handleFlash({ type: 'info', message: 'Конфигурация корректна.' })
      else handleFlash({ type: 'warning', message: 'Обнаружены замечания.' })
    } catch (e) {
      if (e instanceof AdminApiError && e.fieldErrors?.length) { setFieldErrors(e.fieldErrors); handleFlash({ type: 'error', message: 'Ошибки в данных формы.' }) }
      else handleFlash({ type: 'error', message: (e as Error).message })
    } finally { setBusyAction(null) }
  }, [current, assembleBody])
  const saveDraft = useCallback(async () => {
    if (!current) return
    setBusyAction('save'); setFieldErrors([]); setWarnings([]); setConflictVersion(null)
    try {
      const { body, result } = await assembleBody()
      const created = await client.createDraft(body)
      setDraft(created)
      const snap = flatten(created, metadata)
      setSavedSnapshot(snap)
      setWarnings(result.warnings)
      handleFlash({ type: 'info', message: `Черновик ревизии #${created.revision} создан.` })
    } catch (e) {
      if (e instanceof AdminApiError) {
        if (e.fieldErrors?.length) { setFieldErrors(e.fieldErrors); handleFlash({ type: 'error', message: 'Ошибки в данных формы.' }) }
        else if (e.currentVersion !== undefined) { setConflictVersion(e.currentVersion); handleFlash({ type: 'error', message: 'Конфигурация изменилась. Обновите данные.' }) }
        else handleFlash({ type: 'error', message: e.message })
      } else handleFlash({ type: 'error', message: (e as Error).message })
    } finally { setBusyAction(null) }
  }, [current, assembleBody, client, metadata])
  const activateDraft = useCallback(async () => {
    if (!draft || draftStale) return
    setBusyAction('activate')
    try {
      const config = await client.activate(draft.id)
      setCurrent(config); const flat = flatten(config, metadata); setModel(flat); setSavedSnapshot(flat)
      setDraft(null); setFieldErrors([]); setWarnings([])
      handleFlash({ type: 'info', message: `Конфигурация ревизии #${config.revision} активирована.` })
    } catch (e) {
      if (e instanceof AdminApiError && e.currentVersion !== undefined) { setConflictVersion(e.currentVersion); handleFlash({ type: 'error', message: 'Конфигурация изменилась.' }) }
      else handleFlash({ type: 'error', message: (e as Error).message })
    } finally { setBusyAction(null) }
  }, [draft, draftStale, client, metadata])
  const grouped = useMemo(() => {
    if (!current) return []
    const groups: { group: string; params: ParameterMetadata[] }[] = []
    const map = new Map<string, ParameterMetadata[]>()
    for (const p of formParameters(metadata)) {
      const key = p.group
      if (!map.has(key)) { const list: ParameterMetadata[] = []; map.set(key, list); groups.push({ group: key, params: list }) }
      map.get(key)!.push(p)
    }
    return groups
  }, [current, metadata])
  const greenSum = useMemo(() => themeSum(model, metadata, 'green'), [model, metadata])
  const redSum = useMemo(() => themeSum(model, metadata, 'red'), [model, metadata])
  // Live math-model preview that tracks the editor as alpha/mins change.
  const liveCrash = useMemo(() => {
    if (!current) return null
    return {
      alpha: toNumber(model, 'crash.alpha', current.crash.alpha),
      minCrashMultiplier: toNumber(model, 'crash.minCrashMultiplier', current.crash.minCrashMultiplier),
      maxMultiplier: toNumber(model, 'crash.maxMultiplier', current.crash.maxMultiplier),
    }
  }, [current, model])
  const modelCurve = useMemo(() => liveCrash ? theoreticalCurve(liveCrash) : [], [liveCrash])
  const previewP = liveCrash ? [2, 5, 10].map(x => ({ x, p: survival(x, liveCrash.alpha) })) : []
  const themeLevelCount = (theme: 'green' | 'red') => theme === 'green' ? metadata.greenLevelCount : metadata.redLevelCount
  if (loadError) return <div className="admin-error">{loadError} <button className="admin-link-button" onClick={() => void reload()}>Повторить</button></div>
  if (!current) return <div className="admin-loading">Загружаем конфигурацию…</div>
  return <div>
    <div className="admin-page-head"><div><p className="admin-eyebrow">РЕДАКТОР КОНФИГУРАЦИИ</p><h1>Конфигурация</h1>
      <p className="admin-hint">Измените параметры и сохраните черновик ревизии #{nextRevision}. Активация потребует отдельного шага.</p></div></div>
    {conflictVersion !== null && <div className="admin-warning admin-mb-16" role="status">
      Конфигурация изменилась на стороне сервера (текущая ревизия: <strong>#{conflictVersion}</strong>).
      <button className="admin-link-button" onClick={() => void reload()}>Обновить</button></div>}
    {flash && <div role="status" className={`admin-${flash.type === 'error' ? 'error' : flash.type === 'warning' ? 'warning' : 'success'} admin-mb-16`}>{flash.message}{flash.details && <small>{flash.details}</small>}</div>}
    {fieldErrors.length > 0 && <div className="admin-error-box admin-mb-16">
      <strong>Ошибки формы:</strong>
      <ul>{fieldErrors.map((e, i) => <li key={i}><code>{e.field}</code>: {e.message}{e.rejectedValue !== undefined && <span className="admin-mono"> (получено: {String(e.rejectedValue)})</span>}</li>)}</ul>
    </div>}
    {warnings.length > 0 && <div className="admin-warning admin-mb-16">
      <strong>Предупреждения:</strong>
      <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
    </div>}
    <div className="admin-editor-controls">
      <button className="admin-secondary" onClick={() => void validate()} disabled={busyAction === 'validate' || !current}>{busyAction === 'validate' ? 'Проверяем…' : 'Проверить'}</button>
      <button className="admin-primary" onClick={() => void saveDraft()} disabled={busyAction === 'save' || !current}>{busyAction === 'save' ? 'Сохраняем…' : `Сохранить черновик (#${nextRevision})`}</button>
      <button className="admin-primary admin-activate-button" onClick={() => void activateDraft()} disabled={busyAction === 'activate' || !draft || draftStale}>{busyAction === 'activate' ? 'Активируем…' : `Активировать черновик${draft ? ` (#${draft.revision})` : ''}`}</button>
      {draftStale && <p className="admin-hint">Значения изменились после сохранения черновика — сохраните черновик заново, чтобы активировать актуальные данные.</p>}
    </div>
    {grouped.map(({ group, params }) => <section key={group} className="admin-card admin-mb-16">
      <h2 className="admin-card-title">{group === 'general' ? 'Общие' : group === 'crash' ? 'Краш-модель' : group === 'boosters' ? 'Бустеры' : 'Очки'}</h2>
      {group === 'general' && <div className="admin-read-only">
        <div className="admin-fields admin-fields-2">{params.filter(p => p.dataType !== 'boolean').map(p => <div key={p.technicalName} className="admin-field-row">
          <dt>{p.displayName}</dt>
          <dd>{formatValue(p, model[p.technicalName])}{p.description && <small>{p.description}</small>}</dd>
        </div>)}</div>
        {params.filter(p => p.dataType === 'boolean').map(p => <div key={p.technicalName} className="admin-form-grid admin-mb-16">
          <label className="admin-form-label"><span className="admin-field-head">
            <span>{p.displayName}</span><FieldHelp param={p} value={model[p.technicalName] ?? String(current.isActive)} />
          </span>
            <select value={model[p.technicalName] ?? String(current.isActive)} onChange={e => setField(p.technicalName, e.target.value)}>
              <option value="true">Включена — новые раунды принимаются</option>
              <option value="false">Выключена — новые раунды отклоняются</option>
            </select>
            <small className="admin-hint">{p.description ? `${p.description}. ` : ''}{p.effectOnGame}</small>
          </label>
        </div>)}
      </div>}
      {group === 'crash' && <>
        <div className="admin-chart-block admin-mb-20">
          {liveCrash && <>
            <div className="admin-chart-head"><h3 className="admin-section-label admin-plain">График математической модели</h3>
              <span className="admin-chart-note">P(X ≥ x) = (1 − α) / x · перестраивается при изменении α</span></div>
            <LineChart height={260} series={[{
              name: `P(X ≥ x), α = ${liveCrash.alpha}`,
              color: '#246b50',
              points: modelCurve,
            }]} />
            <div className="admin-chart-preview">
              <span>α = <b>{liveCrash.alpha}</b></span>
              {previewP.map(({ x, p }) => <span key={x}>P(X ≥ {x}) = <b>{(p * 100).toFixed(2)}%</b></span>)}
              <span>min = <b>{liveCrash.minCrashMultiplier}</b></span>
              <span>max = <b>{liveCrash.maxMultiplier}</b></span>
            </div>
          </>}
        </div>
        <div className="admin-form-grid">{params.map(p => <NumberField key={p.technicalName} param={p} model={model} onChange={setField} />)}</div>
      </>}
      {group === 'boosters' && <>
        <h3 className="admin-section-label">Значения бустеров</h3>
        <div className="admin-form-grid admin-mb-20">{params.filter(p => p.semanticType === 'multiplier').map(p => <NumberField key={p.technicalName} param={p} model={model} onChange={setField} />)}</div>
        <div className="admin-theme-tabs" role="tablist" aria-label="Тема бустеров">
          {(['green', 'red'] as const).map(theme => {
            const sum = theme === 'green' ? greenSum : redSum
            const ok = Math.abs(sum - 100) <= 0.01
            return <button key={theme} type="button" role="tab" aria-selected={boosterTheme === theme}
              className={`admin-theme-tab admin-theme-${theme} ${boosterTheme === theme ? 'active' : ''}`}
              onClick={() => setBoosterTheme(theme)} data-testid={`theme-tab-${theme}`}>
              <span className="admin-theme-dot" aria-hidden="true" />
              <strong>{theme === 'green' ? 'Green' : 'Red'} · {themeLevelCount(theme)} линий</strong>
              <small>сумма: {sum.toFixed(2)}%{!ok ? ' (ожидается 100%)' : ''}</small>
            </button>
          })}
        </div>
        <h3 className="admin-section-label">{boosterTheme === 'green' ? 'Вероятности · Зелёный' : 'Вероятности · Красный'}
          <small>другая тема: {boosterTheme === 'green' ? `Red, сумма ${redSum.toFixed(2)}%` : `Green, сумма ${greenSum.toFixed(2)}%`}</small></h3>
        <div className="admin-form-grid admin-mb-20">{params.filter(p => new RegExp(`^boosters\\.${boosterTheme}\\.line\\d+LootProb$`).test(p.technicalName) && p.semanticType === 'probability').map(p => <NumberField key={p.technicalName} param={p} model={model} onChange={setField} />)}</div>
      </>}
      {group === 'points' && <div className="admin-form-grid">{params.map(p => <NumberField key={p.technicalName} param={p} model={model} onChange={setField} />)}</div>}
    </section>)}
  </div>
}

function NumberField({ param, model, onChange, disabled }: { param: ParameterMetadata; model: EditorModel; onChange: (name: string, value: string) => void; disabled?: boolean }) {
  const step = param.dataType === 'integer' ? '1' : '0.1'
  const inputId = `admin-field-${param.technicalName.replace(/\./g, '-')}`
  const descId = param.description || param.effectOnGame ? `desc-${inputId}` : undefined
  return <label className="admin-form-label" htmlFor={inputId}>
    <span className="admin-field-head">
      <span>{param.displayName}{param.unit ? ` (${param.unit})` : ''}</span>
      <FieldHelp param={param} value={model[param.technicalName]} />
    </span>
    <input id={inputId} type="number" step={step} min={param.min ?? undefined} max={param.max ?? undefined} value={model[param.technicalName] ?? ''} onChange={e => onChange(param.technicalName, e.target.value)} disabled={disabled} aria-describedby={descId} />
    {param.allowedValues && <small className="admin-hint">Допустимые: {param.allowedValues.join(', ')}</small>}
    {(param.description || param.effectOnGame) && <small id={descId} className="admin-hint">{param.description ? `${param.description}. ` : ''}{param.effectOnGame}</small>}
  </label>
}

/** Tooltip content for one parameter: purpose, current value, range, impact and math formulas. */
function FieldHelp({ param, value }: { param: ParameterMetadata; value: string | undefined }) {
  const help = CRASH_PARAM_HELP[param.technicalName]
  const rangeText = param.dataType === 'number' || param.dataType === 'integer'
    ? `${param.min ?? '—'}…${param.max ?? '—'}${param.unit ? ` ${param.unit}` : ''}`
    : null
  return <HelpPopover label={`Подробнее: ${param.displayName}`} content={<>
    <div className="admin-help-title">{param.displayName}</div>
    {param.description && <p className="admin-help-line">Назначение: {param.description}</p>}
    <p className="admin-help-line">Текущее значение: <b>{value === undefined || value === '' ? '—' : value}{param.unit ? ` ${param.unit}` : ''}</b></p>
    {rangeText && <p className="admin-help-line">Допустимый диапазон: {rangeText}</p>}
    {param.allowedValues && <p className="admin-help-line">Допустимые: {param.allowedValues.join(', ')}</p>}
    {param.effectOnGame && <p className="admin-help-line">Влияние на игру: {param.effectOnGame}</p>}
    {help && <><p className="admin-help-line">Формула: <code>{help.formula}</code></p>
      <p className="admin-help-line">Пример: {help.example}</p></>}
  </>} />
}
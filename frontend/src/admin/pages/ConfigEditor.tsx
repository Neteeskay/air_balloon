import { useCallback, useEffect, useMemo, useState } from 'react'
import { LineChart } from '../chart'
import { AdminClient, AdminApiError } from '../client'
import { HelpPopover } from '../components'
import { CRASH_PARAM_HELP } from '../help'
import { ruParam } from '../labels'
import { survival, theoreticalCurve } from '../math'
import { assemble, EditorModel, flatten, formParameters, themeSum } from '../model'
import type { ConfigMetadata, FieldViolation, GameConfiguration, GameConfigurationWrite, ParameterMetadata, ValidationResult } from '../types'
import { formatValue } from '../format'

type Flash = { type: 'info' | 'error' | 'warning'; message: string }

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

const GROUP_TITLE: Record<string, string> = {
  general: 'Общие',
  crash: 'Математика краша',
  boosters: 'Бустеры и линии',
  points: 'Очки',
}

export function ConfigEditor({ client, metadata }: { client: AdminClient; metadata: ConfigMetadata }) {
  const [current, setCurrent] = useState<GameConfiguration | null>(null)
  const [model, setModel] = useState<EditorModel>({})
  const [savedSnapshot, setSavedSnapshot] = useState<EditorModel | null>(null)
  const [busyAction, setBusyAction] = useState<'validate' | 'save' | null>(null)
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
        setFieldErrors([]); setWarnings([]); setConflictVersion(null)
      })
      .catch(e => setLoadError((e as Error).message))
  }, [client, metadata])
  useEffect(() => { reload() }, [reload])
  const nextRevision = current ? current.revision + 1 : 0
  const dirty = current !== null && savedSnapshot !== null && !equalModel(model, savedSnapshot)
  const setField = useCallback((name: string, value: string) => setModel(prev => ({ ...prev, [name]: value })), [])
  const assembleBody = useCallback((): GameConfigurationWrite => {
    if (!current) throw new Error('Конфигурация не загружена')
    return assemble(model, current, nextRevision)
  }, [model, current, nextRevision])
  const handleFlash = (flash: Flash) => { setFlash(flash); setTimeout(() => setFlash(null), 12_000) }
  const validate = useCallback(async () => {
    if (!current) return
    setBusyAction('validate'); setFieldErrors([]); setWarnings([])
    try {
      const result: ValidationResult = await client.validate(assembleBody())
      setWarnings(result.warnings)
      handleFlash(result.valid
        ? { type: 'info', message: 'Все значения в порядке, можно сохранять.' }
        : { type: 'warning', message: 'Есть замечания — посмотрите предупреждения.' })
    } catch (e) {
      if (e instanceof AdminApiError && e.fieldErrors?.length) { setFieldErrors(e.fieldErrors); handleFlash({ type: 'error', message: 'В форме есть ошибки.' }) }
      else handleFlash({ type: 'error', message: (e as Error).message })
    } finally { setBusyAction(null) }
  }, [current, assembleBody, client])
  const save = useCallback(async () => {
    if (!current) return
    setBusyAction('save'); setFieldErrors([]); setWarnings([]); setConflictVersion(null)
    try {
      const body = assembleBody()
      const result: ValidationResult = await client.validate(body)
      setWarnings(result.warnings)
      if (!result.valid) return
      const created = await client.createDraft(body)
      let activated: GameConfiguration
      try {
        activated = await client.activate(created.id)
      } catch (e) {
        await reload()
        if (e instanceof AdminApiError && e.currentVersion !== undefined) {
          setConflictVersion(e.currentVersion)
          handleFlash({ type: 'error', message: 'Настройки менялись на сервере. Данные обновлены — сохраните ещё раз.' })
        } else {
          handleFlash({ type: 'error', message: `Изменения не применились: ${(e as Error).message}` })
        }
        return
      }
      const flat = flatten(activated, metadata)
      setCurrent(activated); setModel(flat); setSavedSnapshot(flat)
      handleFlash({ type: 'info', message: `Изменения сохранены и применены — ревизия #${activated.revision}.` })
    } catch (e) {
      if (e instanceof AdminApiError) {
        if (e.fieldErrors?.length) { setFieldErrors(e.fieldErrors); handleFlash({ type: 'error', message: 'В форме есть ошибки.' }) }
        else if (e.currentVersion !== undefined) { setConflictVersion(e.currentVersion); handleFlash({ type: 'error', message: 'Настройки менялись на сервере. Данные обновлены — сохраните ещё раз.' }) }
        else handleFlash({ type: 'error', message: e.message })
      } else handleFlash({ type: 'error', message: (e as Error).message })
    } finally { setBusyAction(null) }
  }, [current, assembleBody, reload, client, metadata])
  const resetChanges = useCallback(() => { if (savedSnapshot) { setModel(savedSnapshot); setFieldErrors([]); setWarnings([]) } }, [savedSnapshot])
  const grouped = useMemo(() => {
    if (!current) return []
    const groups: { group: string; params: ParameterMetadata[] }[] = []
    const map = new Map<string, ParameterMetadata[]>()
    for (const p of formParameters(metadata).map(ruParam)) {
      const key = p.group
      if (!map.has(key)) { const list: ParameterMetadata[] = []; map.set(key, list); groups.push({ group: key, params: list }) }
      map.get(key)!.push(p)
    }
    return groups
  }, [current, metadata])
  const greenSum = useMemo(() => themeSum(model, metadata, 'green'), [model, metadata])
  const redSum = useMemo(() => themeSum(model, metadata, 'red'), [model, metadata])
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
  const general = grouped.find(g => g.group === 'general')?.params ?? []
  const crashParams = grouped.find(g => g.group === 'crash')?.params ?? []
  const boostersParams = grouped.find(g => g.group === 'boosters')?.params ?? []
  const pointsParams = grouped.find(g => g.group === 'points')?.params ?? []
  return <div>
    <div className="admin-page-head">
      <div>
        <p className="admin-eyebrow">НАСТРОЙКА ИГРЫ</p>
        <h1>Конфигурация</h1>
        <p className="admin-hint">Измените параметры и нажмите «Сохранить и применить» — изменения вступят в силу сразу.</p>
      </div>
      {current && <span className="admin-pill">ревизия #{current.revision}</span>}
    </div>
    {conflictVersion !== null && <div className="admin-warning admin-mb-14" role="status">
      Настройки менялись на сервере (текущая ревизия: <strong>#{conflictVersion}</strong>).
      <button className="admin-link-button" onClick={() => void reload()}>Обновить</button></div>}
    {flash && <div role="status" className={`admin-${flash.type === 'error' ? 'error-box' : flash.type === 'warning' ? 'warning' : 'success'} admin-mb-14`}>{flash.message}</div>}
    {fieldErrors.length > 0 && <div className="admin-error-box admin-mb-14">
      <strong>Ошибки формы:</strong>
      <ul>{fieldErrors.map((e, i) => <li key={i}><code>{e.field}</code>: {e.message}</li>)}</ul>
    </div>}
    {warnings.length > 0 && <div className="admin-warning admin-mb-14">
      <strong>Предупреждения:</strong>
      <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
    </div>}
    <div className="admin-editor-controls">
      <button className="admin-secondary" onClick={() => void validate()} disabled={busyAction !== null || !dirty}>{busyAction === 'validate' ? 'Проверяем…' : 'Проверить'}</button>
      <button className="admin-secondary admin-danger-link" onClick={() => void resetChanges()} disabled={busyAction !== null || !dirty}>Отменить изменения</button>
      <button className="admin-primary" onClick={() => void save()} disabled={busyAction !== null || !dirty || !current}>{busyAction === 'save' ? 'Сохраняем…' : 'Сохранить и применить'}</button>
      {!dirty && <span className="admin-hint">Изменений пока нет.</span>}
    </div>
    <section className="admin-card admin-mb-14">
      <h2 className="admin-card-title">{GROUP_TITLE.general}</h2>
      {general.filter(p => p.dataType === 'boolean').map(p => <div key={p.technicalName} className="admin-form-grid admin-two-cols">
        <SelectField param={p} value={model[p.technicalName] ?? String(current.isActive)} onChange={setField} />
      </div>)}
      <div className="admin-fields admin-fields-2">{general.filter(p => p.dataType !== 'boolean').map(p => <div key={p.technicalName} className="admin-field-row">
        <dt>{p.displayName}</dt>
        <dd>{formatValue(p, model[p.technicalName])}</dd>
      </div>)}</div>
    </section>
    <section className="admin-card admin-mb-14">
      <h2 className="admin-card-title">{GROUP_TITLE.crash}</h2>
      <div className="admin-crash-layout">
        <div className="admin-crash-params">
          <p className="admin-section-label admin-plain">Параметры модели</p>
          {crashParams.map(p => <NumberField key={p.technicalName} param={p} model={model} onChange={setField} />)}
          {liveCrash && <div className="admin-chart-chips">
            <span>P(X ≥ 2) ≈ <b>{previewP[0] ? (previewP[0].p * 100).toFixed(2) : '—'}%</b></span>
            <span>P(X ≥ 5) ≈ <b>{previewP[1] ? (previewP[1].p * 100).toFixed(2) : '—'}%</b></span>
            <span>P(X ≥ 10) ≈ <b>{previewP[2] ? (previewP[2].p * 100).toFixed(2) : '—'}%</b></span>
          </div>}
        </div>
        <div className="admin-chart-block">
          {liveCrash && <>
            <div className="admin-chart-head">
              <h3 className="admin-section-label admin-plain">Вероятность, что множитель будет не ниже x<small>P(X ≥ x) = (1 − α) / x</small></h3>
            </div>
            <LineChart height={250} series={[{ name: 'Теория', color: '#246b50', points: modelCurve }]} />
          </>}
        </div>
      </div>
    </section>
    <section className="admin-card admin-mb-14">
      <h2 className="admin-card-title">{GROUP_TITLE.boosters}</h2>
      <div className="admin-theme-tabs" role="tablist" aria-label="Тема бустеров">
        {(['green', 'red'] as const).map(theme => {
          const sum = theme === 'green' ? greenSum : redSum
          const ok = Math.abs(sum - 100) <= 0.01
          return <button key={theme} type="button" role="tab" aria-selected={boosterTheme === theme}
            className={`admin-theme-tab admin-theme-${theme} ${boosterTheme === theme ? 'active' : ''}`}
            onClick={() => setBoosterTheme(theme)} data-testid={`theme-tab-${theme}`}>
            <span className="admin-theme-dot" aria-hidden="true" />
            <strong>{theme === 'green' ? 'Зелёная' : 'Красная'} · {themeLevelCount(theme)} линий</strong>
            <small className={ok ? '' : 'admin-hint-error'}>сумма: {sum.toFixed(2)}%{!ok ? ' — нужно 100%' : ''}</small>
          </button>
        })}
      </div>
      <h3 className="admin-section-label">Множители бустеров</h3>
      <div className="admin-form-grid admin-tier-grid">{boostersParams.filter(p => p.semanticType === 'multiplier').map(p => <NumberField key={p.technicalName} param={p} model={model} onChange={setField} />)}</div>
      <h3 className="admin-section-label">{boosterTheme === 'green' ? 'Шансы линий · Зелёная тема' : 'Шансы линий · Красная тема'}</h3>
      <div className="admin-form-grid admin-mb-0">{boostersParams.filter(p => new RegExp(`^boosters\\.${boosterTheme}\\.line\\d+LootProb$`).test(p.technicalName) && p.semanticType === 'probability').map(p => <NumberField key={p.technicalName} param={p} model={model} onChange={setField} />)}</div>
    </section>
    <section className="admin-card">
      <h2 className="admin-card-title">{GROUP_TITLE.points}</h2>
      <div className="admin-form-grid admin-tier-grid">{pointsParams.map(p => <NumberField key={p.technicalName} param={p} model={model} onChange={setField} />)}</div>
    </section>
  </div>
}

function FieldHead({ param, value }: { param: ParameterMetadata; value: string | undefined }) {
  return <span className="admin-field-head">
    <span>{param.displayName}{param.unit ? `, ${param.unit}` : ''}</span>
    <FieldHelp param={param} value={value} />
  </span>
}

function NumberField({ param, model, onChange, disabled }: { param: ParameterMetadata; model: EditorModel; onChange: (name: string, value: string) => void; disabled?: boolean }) {
  const step = param.dataType === 'integer' ? '1' : '0.1'
  const inputId = `admin-field-${param.technicalName.replace(/\./g, '-')}`
  return <label className="admin-form-label" htmlFor={inputId}>
    <FieldHead param={param} value={model[param.technicalName]} />
    <input id={inputId} type="number" step={step} min={param.min ?? undefined} max={param.max ?? undefined} value={model[param.technicalName] ?? ''} onChange={e => onChange(param.technicalName, e.target.value)} disabled={disabled} />
  </label>
}

function SelectField({ param, value, onChange }: { param: ParameterMetadata; value: string; onChange: (name: string, value: string) => void }) {
  const inputId = `admin-field-${param.technicalName.replace(/\./g, '-')}`
  return <label className="admin-form-label" htmlFor={inputId}>
    <FieldHead param={param} value={value} />
    <select id={inputId} value={value} onChange={e => onChange(param.technicalName, e.target.value)}>
      <option value="true">Да — новые раунды принимаются</option>
      <option value="false">Нет — новые раунды отклоняются</option>
    </select>
  </label>
}

/** Подсказка «?» для одного параметра: назначение, диапазон, влияние и формула. */
function FieldHelp({ param, value }: { param: ParameterMetadata; value: string | undefined }) {
  const help = CRASH_PARAM_HELP[param.technicalName]
  const rangeText = param.dataType === 'number' || param.dataType === 'integer'
    ? `${param.min ?? '—'}…${param.max ?? '—'}${param.unit ? ` ${param.unit}` : ''}`
    : null
  return <HelpPopover label={`Подсказка: ${param.displayName}`} content={<>
    <div className="admin-help-title">{param.displayName}</div>
    {param.description && <p className="admin-help-line">{param.description}</p>}
    {rangeText && <p className="admin-help-line">Допустимый диапазон: <b>{rangeText}</b></p>}
    {value !== undefined && value !== '' && <p className="admin-help-line">Сейчас в форме: <b>{value}</b></p>}
    {param.effectOnGame && <p className="admin-help-line">{param.effectOnGame}</p>}
    {help && <p className="admin-help-line">Формула: <code>{help.formula}</code>, пример: {help.example}</p>}
  </>} />
}
import { useState, type ChangeEvent } from 'react'
import type { Fairness } from '../api/types'
import { calculateCrash, parseProof, verifyCommitment } from '../fairness/verifier'

export function FairnessVerifier({ onBack }: { onBack: () => void }) {
  const [raw, setRaw] = useState('')
  const [proof, setProof] = useState<Fairness | null>(null)
  const [commitment, setCommitment] = useState<boolean | undefined>()
  const [formula, setFormula] = useState<number | undefined>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const verify = async () => {
    setError(''); setProof(null); setCommitment(undefined); setFormula(undefined)
    try {
      const parsed = parseProof(raw); setProof(parsed); setBusy(true)
      setCommitment(await verifyCommitment(parsed)); setFormula(calculateCrash(parsed))
    } catch (e) { setError(e instanceof SyntaxError ? 'Не удалось прочитать JSON. Проверьте скобки и кавычки.' : e instanceof Error ? e.message : 'Не удалось проверить proof.') }
    finally { setBusy(false) }
  }
  const loadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    const reader = new FileReader(); reader.onload = () => setRaw(String(reader.result ?? '')); reader.readAsText(file)
  }
  return <section className="history-card verifier-card" aria-label="Проверка честности раунда">
    <div className="history-title"><div><p className="eyebrow">ПРОЗРАЧНОСТЬ РАУНДА</p><h2>Проверка честности</h2><p>Проверка выполняется прямо в браузере — proof не отправляется на сервер.</p></div><button className="secondary" onClick={onBack}>К игре ↗</button></div>
    <div className="verifier-help"><strong>Как проверить результат</strong><span>После завершения раунда нажмите «Скопировать proof», вставьте JSON сюда и нажмите «Проверить proof».</span></div>
    <label className="verifier-input">Proof JSON<textarea value={raw} onChange={event => setRaw(event.target.value)} placeholder={'{\n  "roundId": "…",\n  "commitment": "sha256:…",\n  "serverSeed": "…",\n  "crashMultiplier": 2.34\n}'} spellCheck={false} /></label>
    <div className="verifier-actions"><label className="secondary file-button">Загрузить JSON<input type="file" accept="application/json,.json" onChange={loadFile} /></label><button className="primary" disabled={!raw.trim() || busy} onClick={() => void verify()}>{busy ? 'Проверяем…' : 'Проверить proof'}</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {proof && <div className="verifier-result"><div className="verifier-result-heading"><div><p className="eyebrow">РАУНД {proof.roundId}</p><h3>{proof.status === 'REVEALED' ? 'Результат рассчитан' : 'Reveal ещё закрыт'}</h3></div><span className={`verifier-badge ${commitment === true && (formula === undefined || formula === proof.crashMultiplier) ? 'ok' : commitment === false || (formula !== undefined && formula !== proof.crashMultiplier) ? 'fail' : ''}`}>{proof.status === 'COMMITTED' ? 'ОЖИДАЕМ REVEAL' : commitment === true && formula === proof.crashMultiplier ? 'VERIFIED' : 'НУЖНА ПРОВЕРКА'}</span></div>{proof.status === 'REVEALED' ? <><dl className="proof-details"><dt>Commitment</dt><dd>{commitment === true ? '✓ совпадает' : commitment === false ? '✕ не совпадает' : '— недоступно'}</dd><dt>Фактический crash</dt><dd>{proof.crashMultiplier ?? '—'}</dd><dt>Рассчитанный X</dt><dd><strong>{formula ?? '—'}</strong></dd><dt>Формула</dt><dd>{proof.formulaVersion ?? '—'}</dd></dl>{proof.example && <p className="muted">Демо-proof: интерфейс и расчёт проверены, но commitment mock-режима не является production-доказательством.</p>}</> : <p className="muted">До падения server seed и crash намеренно не раскрываются.</p>}</div>}
  </section>
}

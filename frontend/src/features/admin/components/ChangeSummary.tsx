import type { ChangeSummaryItem } from '../model/configModel';
import { displayValue } from '../utils/format';

export function ChangeSummary({ changes }: { changes: ChangeSummaryItem[] }) {
  if (changes.length === 0) return <p className="muted">Изменений нет.</p>;
  return (
    <div className="change-list">
      {changes.map((change) => (
        <div className="change-item" key={change.field}>
          <div><strong>{change.label}</strong></div>
          <div className="change-values">
            <span>{displayValue(change.before)}</span>
            <span aria-hidden="true">→</span>
            <strong>{displayValue(change.after)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

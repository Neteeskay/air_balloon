import type { ConfigMetadataResponse, DiffResponse } from '../../../types/admin';
import { labelForField } from '../model/configModel';
import { displayValue } from '../utils/format';

export function DiffTable({ diff, metadata }: { diff: DiffResponse; metadata?: ConfigMetadataResponse }) {
  if (diff.changes.length === 0) return <p className="muted">Различий нет.</p>;
  return (
    <div className="table-scroll">
      <table className="data-table diff-table">
        <thead><tr><th>Параметр</th><th>Было</th><th>Стало</th></tr></thead>
        <tbody>
          {diff.changes.map((change) => (
            <tr key={change.field}>
              <td><strong>{labelForField(change.field, metadata)}</strong></td>
              <td className="diff-before">{displayValue(change.before)}</td>
              <td className="diff-after">{displayValue(change.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

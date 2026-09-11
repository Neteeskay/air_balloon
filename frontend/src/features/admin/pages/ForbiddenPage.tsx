import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return <div className="standalone-state"><h1>403 — Недостаточно прав</h1><p>Эта административная операция недоступна для текущей учётной записи.</p><Link className="button button--primary" to="/admin">Вернуться к обзору</Link></div>;
}

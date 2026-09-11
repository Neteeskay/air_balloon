import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <div className="standalone-state"><h1>Страница не найдена</h1><p>Проверьте адрес или вернитесь в административную панель.</p><Link className="button button--primary" to="/admin">К обзору</Link></div>;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Включено' : 'Выключено';
  if (typeof value === 'number') return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 12 }).format(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

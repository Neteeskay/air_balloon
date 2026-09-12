export const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('ru-RU') : '—')
export const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8) : '—')

export const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 6 })

export const datetimeLocal = (iso: string) => {
  const value = new Date(iso)
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

export const actionLabel = (action: string) =>
  ({
    CONFIG_CREATED: 'Конфигурация создана',
    CONFIG_VALIDATED: 'Валидация конфигурации',
    CONFIG_ACTIVATED: 'Конфигурация активирована',
    CONFIG_ROLLBACK: 'Откат конфигурации',
    ADMIN_LOGIN: 'Вход администратора',
    ADMIN_LOGOUT: 'Выход администратора',
  })[action] ?? action

export const statusLabel = (status: string) =>
  ({ DRAFT: 'Черновик', ACTIVE: 'Активна', ARCHIVED: 'Архив' })[status] ?? status

export const formatValue = (meta: { dataType: string; unit: string | null; semanticType: string | null }, value: unknown) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number' && meta.semanticType === 'multiplier') return `×${value}`
  if (typeof value === 'number' && meta.semanticType === 'probability') return `${value}%`
  if (typeof value === 'number') return `${number(value)}${meta.unit ? ` ${meta.unit}` : ''}`
  return String(value)
}
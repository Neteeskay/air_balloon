const normalizeBaseUrl = (value: string | undefined) =>
  value?.trim().replace(/\/+$/, '') ?? ''

export const env = {
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
} as const

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${env.apiBaseUrl}${normalizedPath}`
}

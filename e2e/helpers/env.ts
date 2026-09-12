export const settings = {
  apiUrl: process.env.ACCEPTANCE_API_URL ?? 'http://127.0.0.1:18080',
  frontendUrl: process.env.ACCEPTANCE_FRONTEND_URL
    ?? `http://${process.env.FRONTEND_HOST ?? '127.0.0.1'}:${process.env.FRONTEND_PORT ?? '5173'}`,
  wsUrl: process.env.ACCEPTANCE_WS_URL ?? wsFromHttp(process.env.ACCEPTANCE_API_URL ?? 'http://127.0.0.1:18080'),
  username: process.env.ACCEPTANCE_USERNAME ?? 'anna',
  password: process.env.ACCEPTANCE_PASSWORD ?? 'balloon1',
  secondUsername: process.env.ACCEPTANCE_SECOND_USERNAME ?? 'maks',
  adminToken: process.env.ACCEPTANCE_ADMIN_TOKEN ?? 'local-demo-admin',
  stake: process.env.ACCEPTANCE_STAKE ?? '4',
  unaffordableStake: process.env.ACCEPTANCE_UNAFFORDABLE_STAKE,
  booster: Number(process.env.ACCEPTANCE_BOOSTER ?? '2'),
  eventTimeoutMs: Number(process.env.ACCEPTANCE_EVENT_TIMEOUT_MS ?? '120000'),
  authHeaders: parseHeaders(process.env.ACCEPTANCE_AUTH_HEADERS),
  secondAuthHeaders: parseHeaders(process.env.ACCEPTANCE_SECOND_AUTH_HEADERS)
};

function wsFromHttp(url: string): string {
  return `${url.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/rounds`;
}

function parseHeaders(value: string | undefined): Record<string, string> {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('ACCEPTANCE_*_AUTH_HEADERS must be a JSON object');
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('ACCEPTANCE_*_AUTH_HEADERS must be a JSON object');
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item)]));
}

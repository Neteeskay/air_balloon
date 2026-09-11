import { MockBackend } from './mock'
import { createRealApi } from './real'
const mode = import.meta.env.VITE_API_MODE ?? 'mock'
if (mode !== 'mock' && mode !== 'real') throw new Error('VITE_API_MODE must be mock or real')
export const api = mode === 'real' ? createRealApi(import.meta.env.VITE_API_BASE_URL ?? '') : new MockBackend(localStorage).api

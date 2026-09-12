import { MockBackend } from './mock'
import { createRealApi } from './real'
// Real backend is authoritative in the shipped application. Mock backend is opt-in for Storybook/tests.
const mode = import.meta.env.VITE_API_MODE ?? 'real'
if (mode !== 'mock' && mode !== 'real') throw new Error('VITE_API_MODE must be mock or real')
export const api = mode === 'real' ? createRealApi(import.meta.env.VITE_API_BASE_URL ?? '') : new MockBackend(localStorage).api

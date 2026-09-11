import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';
import { resetAuthSessionForTests } from '../services/authSession';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthSessionForTests();
  sessionStorage.clear();
});
afterAll(() => server.close());

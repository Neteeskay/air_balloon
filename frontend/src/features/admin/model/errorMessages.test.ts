import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../services/apiClient';
import { mapApiError } from './errorMessages';

describe('error mapping', () => {
  it('maps version conflict to a human message and preserves traceId', () => {
    const result = mapApiError(new ApiError({ status: 409, code: 'CONFIG_VERSION_CONFLICT', message: 'raw', traceId: 'trace-1', currentVersion: 11 }));
    expect(result.title).toContain('уже была изменена');
    expect(result.traceId).toBe('trace-1');
  });

  it('keeps 403 distinct from invalid credentials', () => {
    const result = mapApiError(new ApiError({ status: 403, code: 'FORBIDDEN' }));
    expect(result.title).toBe('Недостаточно прав');
  });
});

import { describe, expect, it } from 'vitest';
import { parseAuditMetadata } from './audit';

describe('parseAuditMetadata', () => {
  it('parses valid object JSON into safe key/value data', () => {
    expect(parseAuditMetadata('{"revision":11,"previousRevision":10}')).toEqual({
      kind: 'json',
      entries: [['revision', '11'], ['previousRevision', '10']],
    });
  });


  it('redacts potentially sensitive metadata keys', () => {
    expect(parseAuditMetadata('{"revision":11,"accessToken":"secret-value"}')).toEqual({
      kind: 'json',
      entries: [['revision', '11'], ['accessToken', '[скрыто]']],
    });
  });

  it('falls back to plain text for invalid JSON', () => {
    expect(parseAuditMetadata('<img src=x onerror=alert(1)>')).toEqual({
      kind: 'text',
      text: '<img src=x onerror=alert(1)>',
    });
    expect(parseAuditMetadata('Authorization: Bearer secret')).toEqual({
      kind: 'text',
      text: '[содержимое скрыто: возможные секреты]',
    });
  });
});

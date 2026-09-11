export type SafeMetadata =
  | { kind: 'json'; entries: Array<[string, string]> }
  | { kind: 'text'; text: string }
  | { kind: 'empty' };

const secretKeyPattern = /(password|passwd|token|secret|authorization|credential|api[-_]?key)/i;

function sanitizeUnknown(value: unknown, key?: string): unknown {
  if (key && secretKeyPattern.test(key)) return '[скрыто]';
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeUnknown(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function safeMetadataValue(key: string, value: unknown): string {
  const sanitized = sanitizeUnknown(value, key);
  return typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
}

function safeFallbackText(value: string): string {
  return secretKeyPattern.test(value) ? '[содержимое скрыто: возможные секреты]' : value;
}

export function parseAuditMetadata(value?: string | null): SafeMetadata {
  if (!value?.trim()) return { kind: 'empty' };
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        kind: 'json',
        entries: Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [
          key,
          safeMetadataValue(key, item),
        ]),
      };
    }
  } catch {
    // Fallback below intentionally renders backend data as text only.
  }
  return { kind: 'text', text: safeFallbackText(value) };
}

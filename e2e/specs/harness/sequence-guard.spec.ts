import { expect, test } from '@playwright/test';
import { SequenceGuard } from '../../helpers/sequence-guard';

test('HARNESS-SEQUENCE detects 10,12,11 gap and does not apply out of order', () => {
  const guard = new SequenceGuard('round', 9);
  expect(guard.inspect({ roundId: 'round', sequence: 10, eventId: 'round:10' })).toBe('APPLIED');
  expect(guard.inspect({ roundId: 'round', sequence: 12, eventId: 'round:12' })).toBe('GAP');
  expect(guard.current()).toBe(10);
  expect(guard.inspect({ roundId: 'round', sequence: 11, eventId: 'round:11' })).toBe('APPLIED');
  expect(guard.inspect({ roundId: 'round', sequence: 12, eventId: 'round:12' })).toBe('APPLIED');
});

test('HARNESS-SEQUENCE snapshot reset drops duplicates and resumes ordered events', () => {
  const guard = new SequenceGuard('round', 10);
  guard.resetFromSnapshot(12);
  expect(guard.inspect({ roundId: 'round', sequence: 11 })).toBe('DUPLICATE');
  expect(guard.inspect({ roundId: 'round', sequence: 13 })).toBe('APPLIED');
});

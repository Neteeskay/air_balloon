import { describe, expect, it } from 'vitest';
import { currentConfig, metadata } from '../../../test/fixtures';
import {
  buildCandidateRequest,
  getChangeSummary,
  getProbabilityKeys,
  isNormalizedProbabilityModel,
  parseDecimalInput,
  probabilitySummary,
  toEditableConfig,
} from './configModel';

describe('config model', () => {
  it('builds a candidate without read-only response fields', () => {
    const editable = toEditableConfig(currentConfig);
    editable.points.pointsPerLine = '50';
    const candidate = buildCandidateRequest(editable, currentConfig.revision);
    expect(candidate.revision).toBe(10);
    expect(candidate.points.pointsPerLine).toBe(50);
    expect(candidate).not.toHaveProperty('id');
    expect(candidate).not.toHaveProperty('status');
    expect(candidate).not.toHaveProperty('createdAt');
    expect(candidate).not.toHaveProperty('activatedAt');
  });

  it('preserves meaningful decimal precision and accepts comma input', () => {
    expect(parseDecimalInput('0.0166666667')).toBe(0.0166666667);
    expect(parseDecimalInput('0,15')).toBe(0.15);
    expect(() => parseDecimalInput('1,234.5')).toThrow();
  });

  it('creates change summary only for changed fields', () => {
    const editable = toEditableConfig(currentConfig);
    editable.points.pointsPerLine = '50';
    const candidate = buildCandidateRequest(editable, 10);
    const changes = getChangeSummary(currentConfig, candidate, metadata);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ field: 'points.pointsPerLine', before: 10, after: 50 });
  });

  it('derives probability keys from actual payload/metadata and calculates weight sum', () => {
    expect(getProbabilityKeys('green', currentConfig, metadata)).toHaveLength(9);
    expect(probabilitySummary(toEditableConfig(currentConfig).boosters.green)).toBe(90);
    expect(isNormalizedProbabilityModel('WEIGHTS')).toBe(false);
    expect(isNormalizedProbabilityModel('NORMALIZED_PROBABILITY')).toBe(true);
  });
});

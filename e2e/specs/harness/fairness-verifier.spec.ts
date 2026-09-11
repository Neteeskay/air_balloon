import { expect, test } from '@playwright/test';
import { canonicalInput, computeCommitment, verifyFairness, type FairnessProof } from '../../helpers/fairness';

const proof: FairnessProof = {
  roundId: '00000000-0000-0000-0000-000000000123',
  status: 'REVEALED',
  commitment: 'sha256:fb553c3b8fce90e8b7b024d5917254fb402b22b343ebf2cf96209cb8f6008456',
  algorithm: 'SHA-256',
  format: 'air-balloon-fairness:v1',
  serverSeed: '42',
  crashMultiplier: '8.4200',
  boosterLevel: 3
};

test('HARNESS-FAIRNESS independent verifier accepts golden proof', () => {
  expect(canonicalInput(proof)).toContain('crashMultiplier=8.42\n');
  expect(computeCommitment(proof)).toBe(proof.commitment);
  expect(verifyFairness(proof, proof.commitment)).toBe(true);
});

for (const [field, value] of [
  ['crashMultiplier', 9.42],
  ['boosterLevel', 4],
  ['serverSeed', '43'],
  ['roundId', '00000000-0000-0000-0000-000000000124']
] as const) {
  test(`HARNESS-FAIRNESS tampered ${field} is NOT VERIFIED`, () => {
    expect(verifyFairness({ ...proof, [field]: value }, proof.commitment)).toBe(false);
  });
}

test('HARNESS-FAIRNESS ignores server verified and canonicalInput claims', () => {
  const tampered = { ...proof, crashMultiplier: 9.42, verified: true, canonicalInput: canonicalInput(proof) };
  expect(verifyFairness(tampered, proof.commitment)).toBe(false);
});

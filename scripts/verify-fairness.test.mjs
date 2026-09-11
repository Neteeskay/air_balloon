import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalInput, computeCommitment, verifyFairness } from './verify-fairness.mjs';

const proof = JSON.parse(readFileSync(new URL('./fixtures/fairness-proof.json', import.meta.url), 'utf8'));
test('golden proof is independently VERIFIED', () => assert.equal(verifyFairness(proof, proof.commitment), true));
for (const [field, value] of [['crashMultiplier', 9.42], ['boosterLevel', 4], ['serverSeed', '43'], ['roundId', '00000000-0000-0000-0000-000000000124']]) {
  test(`tampered ${field} is NOT VERIFIED`, () => assert.equal(verifyFairness({ ...proof, [field]: value }, proof.commitment), false));
}
test('scale and JSON property order cannot change hash', () => {
  const reversed = Object.fromEntries(Object.entries(proof).reverse());
  assert.equal(computeCommitment({ ...reversed, crashMultiplier: '8.4200' }), proof.commitment);
});
test('verifier uses fields, not server supplied canonicalInput or verified flag', () => {
  assert.equal(verifyFairness({ ...proof, crashMultiplier: 9.42, verified: true, canonicalInput: canonicalInput(proof) }, proof.commitment), false);
});
test('rewritten proof and hash cannot replace previously saved commitment', () => {
  const rewritten = { ...proof, crashMultiplier: 9.42 };
  rewritten.commitment = computeCommitment(rewritten);
  assert.equal(verifyFairness(rewritten, proof.commitment), false);
});
test('64-bit seeds remain exact and x1 null is explicit', () => {
  assert.match(canonicalInput({ ...proof, serverSeed: '-9223372036854775808', boosterLevel: null }), /serverSeed=-9223372036854775808\ncrashMultiplier=8.42\nboosterLevel=null\n$/);
  assert.throws(() => canonicalInput({ ...proof, serverSeed: 42 }), /decimal string/);
});

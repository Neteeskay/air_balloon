import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function canonicalInput(proof) {
  if (proof.format !== 'air-balloon-fairness:v1' || proof.algorithm !== 'SHA-256') {
    throw new Error('Unsupported proof format or algorithm');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(proof.roundId)) {
    throw new Error('roundId must be a canonical lowercase UUID');
  }
  if (typeof proof.serverSeed !== 'string' || !/^(0|-?[1-9][0-9]*)$/.test(proof.serverSeed)) {
    throw new Error('serverSeed must be a decimal string (never a JavaScript number)');
  }
  const seed = BigInt(proof.serverSeed);
  if (seed < -(1n << 63n) || seed >= (1n << 63n)) throw new Error('Seed outside signed 64-bit range');
  let crash = String(proof.crashMultiplier);
  if (!/^[1-9][0-9]*(\.[0-9]{1,4})?$/.test(crash) || Number(crash) > 1000000) {
    throw new Error('Invalid crash multiplier');
  }
  if (crash.includes('.')) crash = crash.replace(/0+$/, '').replace(/\.$/, '');
  const booster = proof.boosterLevel ?? null;
  if (booster !== null && (!Number.isInteger(booster) || booster < 1 || booster > 12)) {
    throw new Error('Invalid booster level');
  }
  return `air-balloon-fairness:v1\nroundId=${proof.roundId}\nserverSeed=${seed}\ncrashMultiplier=${crash}\nboosterLevel=${booster}\n`;
}

export function computeCommitment(proof) {
  return 'sha256:' + createHash('sha256').update(canonicalInput(proof), 'utf8').digest('hex');
}

export function verifyFairness(proof, originalCommitment) {
  if (!/^sha256:[0-9a-f]{64}$/.test(originalCommitment)) throw new Error('Pass the original commitment saved at ROUND_STARTED');
  return proof.status === 'REVEALED' && proof.commitment === originalCommitment && computeCommitment(proof) === originalCommitment;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] === '--demo') {
      const proof = JSON.parse(readFileSync(new URL('./fixtures/fairness-proof.json', import.meta.url), 'utf8'));
      const original = verifyFairness(proof, proof.commitment);
      const tampered = verifyFairness({ ...proof, crashMultiplier: 9.42 }, proof.commitment);
      console.log(`original: ${original ? 'VERIFIED' : 'NOT VERIFIED'}`);
      console.log(`tampered result: ${tampered ? 'VERIFIED' : 'NOT VERIFIED'}`);
      process.exitCode = original && !tampered ? 0 : 1;
    } else {
      const [file, commitment] = process.argv.slice(2);
      if (!file || !commitment) throw new Error('Usage: node scripts/verify-fairness.mjs proof.json sha256:<original-hash> | --demo');
      const verified = verifyFairness(JSON.parse(readFileSync(file, 'utf8')), commitment);
      console.log(verified ? 'VERIFIED' : 'NOT VERIFIED');
      process.exitCode = verified ? 0 : 1;
    }
  } catch (error) {
    console.error(`NOT VERIFIED: ${error.message}`);
    process.exitCode = 1;
  }
}

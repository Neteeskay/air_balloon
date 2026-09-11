import { createHash } from 'node:crypto';

export type FairnessProof = {
  roundId: string;
  status: string;
  commitment: string;
  algorithm: string;
  format: string;
  serverSeed: string;
  crashMultiplier: string | number;
  boosterLevel?: number | null;
  verified?: boolean;
  canonicalInput?: string;
};

export function canonicalInput(proof: FairnessProof): string {
  if (proof.format !== 'air-balloon-fairness:v1' || proof.algorithm !== 'SHA-256') {
    throw new Error('Unsupported proof format or algorithm');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(proof.roundId)) {
    throw new Error('roundId must be a canonical lowercase UUID');
  }
  if (typeof proof.serverSeed !== 'string' || !/^(0|-?[1-9][0-9]*)$/.test(proof.serverSeed)) {
    throw new Error('serverSeed must be an exact decimal string');
  }
  const seed = BigInt(proof.serverSeed);
  if (seed < -(1n << 63n) || seed >= 1n << 63n) throw new Error('Seed outside signed 64-bit range');
  let crash = String(proof.crashMultiplier);
  if (!/^[1-9]\d*(\.\d{1,4})?$/.test(crash) || Number(crash) > 1_000_000) {
    throw new Error('Invalid crash multiplier');
  }
  crash = crash.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  const booster = proof.boosterLevel ?? null;
  if (booster !== null && (!Number.isInteger(booster) || booster < 1 || booster > 12)) {
    throw new Error('Invalid booster level');
  }
  return `air-balloon-fairness:v1\nroundId=${proof.roundId}\nserverSeed=${seed}\ncrashMultiplier=${crash}\nboosterLevel=${booster}\n`;
}

export function computeCommitment(proof: FairnessProof): string {
  return `sha256:${createHash('sha256').update(canonicalInput(proof), 'utf8').digest('hex')}`;
}

export function verifyFairness(proof: FairnessProof, originalCommitment: string): boolean {
  if (!/^sha256:[0-9a-f]{64}$/.test(originalCommitment)) throw new Error('Invalid original commitment');
  return proof.status === 'REVEALED'
    && proof.commitment === originalCommitment
    && computeCommitment(proof) === originalCommitment;
}

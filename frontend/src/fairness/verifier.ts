import type { Fairness } from '../api/types'

export const canonicalInput = (proof: Fairness) => `air-balloon-fairness:v1\nroundId=${proof.roundId}\nserverSeed=${proof.serverSeed}\ncrashMultiplier=${String(proof.crashMultiplier)}\nboosterLevel=${proof.boosterLevel ?? 'null'}\n`

export const calculateCrash = (proof: Fairness): number | undefined => {
  if (proof.status !== 'REVEALED' || proof.uniformSample === undefined || proof.crashMultiplier === undefined
    || proof.minCrashMultiplier === undefined || proof.maxCrashMultiplier === undefined || proof.alpha === undefined
    || proof.formulaVersion !== 'HOUSE_EDGE_V1') return undefined
  const { uniformSample: u, alpha, minCrashMultiplier: min, maxCrashMultiplier: max } = proof
  const raw = min === max ? min : u < alpha ? min : Math.min(max, (1 - alpha) / (1 - u))
  return Math.floor((raw + Number.EPSILON) * 10000) / 10000
}

export const verifyCommitment = async (proof: Fairness): Promise<boolean | undefined> => {
  if (proof.status !== 'REVEALED' || proof.serverSeed === undefined || proof.crashMultiplier === undefined) return undefined
  if (!globalThis.crypto?.subtle) return undefined
  const canonical = canonicalInput(proof)
  if (proof.canonicalInput !== canonical) return false
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return proof.commitment.toLowerCase() === `sha256:${hex}`
}

export const parseProof = (raw: string): Fairness => {
  const value = JSON.parse(raw) as Fairness
  if (!value || typeof value !== 'object' || typeof value.roundId !== 'string' || typeof value.commitment !== 'string'
    || (value.status !== 'COMMITTED' && value.status !== 'REVEALED')) throw new Error('В proof отсутствуют roundId, commitment или корректный status.')
  return value
}

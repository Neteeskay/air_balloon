export type Sequenced = { roundId: string; sequence: number; eventId?: string };
export type SequenceDecision = 'APPLIED' | 'DUPLICATE' | 'GAP';

export class SequenceGuard {
  private sequence: number;
  readonly roundId: string;

  constructor(roundId: string, snapshotSequence = 0) {
    this.roundId = roundId;
    this.sequence = snapshotSequence;
  }

  current(): number {
    return this.sequence;
  }

  inspect(event: Sequenced): SequenceDecision {
    if (event.roundId !== this.roundId) throw new Error('Event belongs to another round');
    if (event.eventId && event.eventId !== `${event.roundId}:${event.sequence}`) {
      throw new Error(`Invalid eventId for sequence ${event.sequence}`);
    }
    if (event.sequence <= this.sequence) return 'DUPLICATE';
    if (event.sequence !== this.sequence + 1) return 'GAP';
    this.sequence = event.sequence;
    return 'APPLIED';
  }

  resetFromSnapshot(snapshotSequence: number): void {
    if (!Number.isSafeInteger(snapshotSequence) || snapshotSequence < 0) {
      throw new Error('Invalid snapshot sequence');
    }
    this.sequence = snapshotSequence;
  }
}

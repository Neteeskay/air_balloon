import WebSocket, { type RawData } from 'ws';
import type { RoundEvent } from './api-client';
import { blocked } from './status';

type Pending = {
  predicate: (event: any) => boolean;
  resolve: (event: any) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

export class RoundSocket {
  private socket?: WebSocket;
  private readonly events: any[] = [];
  private readonly pending = new Set<Pending>();

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string> = {}
  ) {}

  async connect(timeoutMs = 10_000): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket connection timeout')), timeoutMs);
      const socket = new WebSocket(this.url, { headers: this.headers, origin: process.env.ACCEPTANCE_WS_ORIGIN });
      this.socket = socket;
      socket.on('message', (raw: RawData) => this.onMessage(raw.toString()));
      socket.once('error', (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
      socket.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
    }).catch((error) => blocked(`Game WebSocket is unavailable at ${this.url}: ${String(error)}`));
    await this.waitFor((event) => event?.type === 'CONNECTION_READY', timeoutMs)
      .catch((error) => blocked(`Game WebSocket did not send CONNECTION_READY: ${String(error)}`));
  }

  allForRound(roundId: string): RoundEvent[] {
    return this.events.filter((event) => event.roundId === roundId) as RoundEvent[];
  }

  waitForRound(roundId: string, predicate: (event: RoundEvent) => boolean, timeoutMs = 120_000): Promise<RoundEvent> {
    return this.waitFor((event) => event.roundId === roundId && predicate(event), timeoutMs);
  }

  waitFor(predicate: (event: any) => boolean, timeoutMs = 120_000): Promise<any> {
    const existing = this.events.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const pending: Pending = {
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.pending.delete(pending);
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for WebSocket event`));
        }, timeoutMs)
      };
      this.pending.add(pending);
    });
  }

  async close(): Promise<void> {
    const socket = this.socket;
    if (!socket || socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2_000);
      socket.once('close', () => { clearTimeout(timer); resolve(); });
      socket.close(1000, 'acceptance reconnect');
    });
  }

  abort(): void {
    this.socket?.terminate();
  }

  private onMessage(raw: string): void {
    let event: any;
    try { event = JSON.parse(raw); } catch { return; }
    this.events.push(event);
    for (const pending of [...this.pending]) {
      if (!pending.predicate(event)) continue;
      clearTimeout(pending.timer);
      this.pending.delete(pending);
      pending.resolve(event);
    }
  }
}

import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { isBlockedMessage, type AcceptanceStatus } from '../helpers/status';

type Entry = { id: string; title: string; project: string; status: AcceptanceStatus; durationMs: number; reason?: string };

export default class AcceptanceReporter implements Reporter {
  private readonly entries: Entry[] = [];
  private outputDir: string;

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir ?? path.resolve('artifacts', 'acceptance');
  }

  onBegin(config: FullConfig): void {
    this.outputDir = path.resolve(this.outputDir);
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(path.join(this.outputDir, 'run-metadata.json'), JSON.stringify({
      startedAt: new Date().toISOString(),
      workers: config.workers,
      apiUrl: process.env.ACCEPTANCE_API_URL ?? 'http://127.0.0.1:18080',
      frontendUrl: process.env.ACCEPTANCE_FRONTEND_URL
        ?? `http://${process.env.FRONTEND_HOST ?? '127.0.0.1'}:${process.env.FRONTEND_PORT ?? '5173'}`
    }, null, 2));
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const message = result.errors.map((error) => error.message).join('\n');
    let status: AcceptanceStatus;
    if (result.status === 'skipped') status = 'NOT RUN';
    else if (result.status === 'passed') status = 'PASS';
    else status = isBlockedMessage(message) ? 'BLOCKED' : 'FAIL';
    this.entries.push({
      id: test.title.match(/^([A-Z][A-Z0-9-]+)/)?.[1] ?? 'UNMAPPED',
      title: test.title,
      project: test.parent.project()?.name ?? 'unknown',
      status,
      durationMs: result.duration,
      reason: message || undefined
    });
  }

  onEnd(result: FullResult): void {
    const counts = this.entries.reduce<Record<AcceptanceStatus, number>>((acc, entry) => {
      acc[entry.status] += 1;
      return acc;
    }, { PASS: 0, FAIL: 0, BLOCKED: 0, 'NOT RUN': 0 });
    const report = { finishedAt: new Date().toISOString(), playwrightStatus: result.status, counts, tests: this.entries };
    fs.writeFileSync(path.join(this.outputDir, 'acceptance-summary.json'), JSON.stringify(report, null, 2));
    const rows = this.entries.map((entry) => `| ${entry.id} | ${escapeCell(entry.title)} | ${entry.project} | ${entry.status} | ${escapeCell(firstLine(entry.reason))} |`);
    const markdown = [
      '# Air Balloon acceptance result', '',
      `Generated: ${report.finishedAt}`, '',
      `PASS: ${counts.PASS}; FAIL: ${counts.FAIL}; BLOCKED: ${counts.BLOCKED}; NOT RUN: ${counts['NOT RUN']}`, '',
      '| ID | Test | Project | Status | Reason |',
      '| --- | --- | --- | --- | --- |',
      ...rows, ''
    ].join('\n');
    fs.writeFileSync(path.join(this.outputDir, 'acceptance-summary.md'), markdown);
  }
}

function firstLine(value?: string): string { return value?.split(/\r?\n/)[0] ?? ''; }
function escapeCell(value: string): string { return value.replace(/\|/g, '\\|'); }

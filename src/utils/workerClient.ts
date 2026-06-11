import type { LogEntry } from './logParser';
import type { PatternGroup } from './patternMatcher';

type DoneMessage =
  | { type: 'parse:done'; id: string; logs: LogEntry[] }
  | { type: 'patterns:done'; id: string; patterns: PatternGroup[] };

let workerInstance: Worker | null = null;
const pending = new Map<string, (msg: DoneMessage) => void>();

function getWorker(): Worker {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker(new URL('../workers/logWorker.ts', import.meta.url), {
    type: 'module',
  });
  workerInstance.addEventListener('message', (e: MessageEvent<DoneMessage>) => {
    const resolve = pending.get(e.data.id);
    if (resolve) {
      pending.delete(e.data.id);
      resolve(e.data);
    }
  });
  return workerInstance;
}

export function parseLinesAsync(text: string): Promise<LogEntry[]> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    pending.set(id, (msg) => {
      if (msg.type === 'parse:done') resolve(msg.logs);
    });
    getWorker().postMessage({ type: 'parse', id, text });
  });
}

export function findPatternsAsync(logs: LogEntry[]): Promise<PatternGroup[]> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    pending.set(id, (msg) => {
      if (msg.type === 'patterns:done') resolve(msg.patterns);
    });
    getWorker().postMessage({ type: 'patterns', id, logs });
  });
}

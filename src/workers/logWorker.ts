/// <reference lib="webworker" />
import { parseLogLine, type LogEntry } from '../utils/logParser';
import { findPatterns } from '../utils/patternMatcher';

type ParseMessage = { type: 'parse'; id: string; text: string };
type PatternsMessage = { type: 'patterns'; id: string; logs: LogEntry[] };
type InMessage = ParseMessage | PatternsMessage;

self.addEventListener('message', (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  if (msg.type === 'parse') {
    const out: LogEntry[] = [];
    const lines = msg.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const log = parseLogLine(lines[i]);
      if (log) out.push(log);
    }
    (self as unknown as Worker).postMessage({ type: 'parse:done', id: msg.id, logs: out });
  } else if (msg.type === 'patterns') {
    const patterns = findPatterns(msg.logs);
    (self as unknown as Worker).postMessage({ type: 'patterns:done', id: msg.id, patterns });
  }
});

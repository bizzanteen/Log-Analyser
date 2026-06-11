import { LogEntry } from './logParser';

export interface PatternGroup {
  pattern: string;
  count: number;
  logs: LogEntry[];
  firstOccurrence: number;
  lastOccurrence: number;
}

const LEVEL_WEIGHTS: Record<LogEntry['level'], number> = {
  error: 10,
  warn: 3,
  info: 1,
};

// Order matters: more specific patterns must run before more general ones so they
// don't get partially consumed by a broader regex.
const generalizeMessage = (message: string): string => {
  return (
    message
      // UUIDs first — they contain hex sequences that the hash regex would otherwise grab.
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      // ISO timestamps with optional milliseconds and timezone suffix.
      .replace(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?/g,
        '<TIMESTAMP>',
      )
      // Email addresses.
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<EMAIL>')
      // URLs — keep the origin, replace path/query.
      .replace(/(https?:\/\/[^/\s]+)\/[^\s]*/g, '$1/<PATH>')
      // IPv4 addresses with optional port.
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g, '<IP>')
      // Windows-style file paths.
      .replace(/[a-zA-Z]:\\(?:[\w.-]+\\?)+/g, '<PATH>')
      // POSIX-style file paths (two or more segments to avoid eating single slashes).
      .replace(/(?:\/[\w.-]+){2,}/g, '<PATH>')
      // Hex hashes ≥32 chars.
      .replace(/\b[0-9a-f]{32,}\b/gi, '<HASH>')
      // Semver (with optional pre-release).
      .replace(/\b\d+\.\d+\.\d+(?:-[\w.]+)?\b/g, '<VERSION>')
      // JSON-ish blobs ≥20 chars (avoids eating tiny `{a}` placeholders).
      .replace(/\{[^{}\n]{20,}\}/g, '<JSON>')
      // Remaining numeric runs of 3+ digits (request IDs, error codes, large counters).
      .replace(/\b\d{3,}\b/g, '<NUMBER>')
  );
};

const groupMaxLevel = (logs: LogEntry[]): LogEntry['level'] => {
  let max: LogEntry['level'] = 'info';
  for (const log of logs) {
    if (log.level === 'error') return 'error';
    if (log.level === 'warn') max = 'warn';
  }
  return max;
};

export const findPatterns = (logs: LogEntry[]): PatternGroup[] => {
  const patterns = new Map<string, PatternGroup>();

  for (const log of logs) {
    const pattern = generalizeMessage(log.message);
    let group = patterns.get(pattern);
    if (!group) {
      group = {
        pattern,
        count: 0,
        logs: [],
        firstOccurrence: log.timestamp,
        lastOccurrence: log.timestamp,
      };
      patterns.set(pattern, group);
    }
    group.count++;
    group.logs.push(log);
    if (log.timestamp < group.firstOccurrence) group.firstOccurrence = log.timestamp;
    if (log.timestamp > group.lastOccurrence) group.lastOccurrence = log.timestamp;
  }

  // Score by count × max-severity weight so error-level patterns surface above
  // chatty info-level patterns of equal or higher count.
  const scored = Array.from(patterns.values()).map((group) => ({
    group,
    score: group.count * LEVEL_WEIGHTS[groupMaxLevel(group.logs)],
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.group);
};

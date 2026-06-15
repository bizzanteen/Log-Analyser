import type { LogEntry, LogFile, LogStats } from './logParser';
import type { PatternGroup } from './patternMatcher';
import type { HarBucketCounts } from '../components/logs/LogStats';

export interface TicketReplyInput {
  sourceType: 'desktop' | 'har';
  files: LogFile[];
  stats: LogStats;
  filteredLogs: LogEntry[];
  patterns: PatternGroup[];
  workspaceIds: string[];
  harBuckets?: HarBucketCounts;
  filter: string | string[];
  searchTerms: string[];
  searchScope: 'current' | 'all';
  selectedFileName: string | null;
  dateRange: { start: string; end: string };
  includeFilteredLogs: boolean;
  /** Cap on filtered-log entries to embed in the reply. Default 50. */
  maxLogs?: number;
  /** Cap on patterns to embed. Default 10. */
  maxPatterns?: number;
}

const formatTs = (ms: number): string => {
  if (!Number.isFinite(ms)) return '–';
  return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
};

const range = (logs: LogEntry[]): { from: number | null; to: number | null } => {
  if (logs.length === 0) return { from: null, to: null };
  let min = logs[0].timestamp;
  let max = logs[0].timestamp;
  for (const log of logs) {
    if (log.timestamp < min) min = log.timestamp;
    if (log.timestamp > max) max = log.timestamp;
  }
  return { from: min, to: max };
};

const filterSummary = (input: TicketReplyInput): string => {
  const parts: string[] = [];

  if (input.sourceType === 'har') {
    if (Array.isArray(input.filter)) {
      parts.push(`Status: ${input.filter.join(', ')}`);
    } else if (input.filter !== 'all') {
      parts.push(`Status: ${input.filter}`);
    }
  } else {
    if (Array.isArray(input.filter)) {
      parts.push(`Level: ${input.filter.join(', ')}`);
    } else if (input.filter !== 'all') {
      parts.push(`Level: ${input.filter}`);
    }
  }

  if (input.searchTerms.length > 0) {
    parts.push(`Search: ${input.searchTerms.map((t) => `"${t}"`).join(' OR ')}`);
  }

  if (input.dateRange.start || input.dateRange.end) {
    parts.push(`Date: ${input.dateRange.start || '…'} → ${input.dateRange.end || '…'}`);
  }

  if (input.searchScope === 'current' && input.selectedFileName) {
    parts.push(`Scope: current file (${input.selectedFileName})`);
  } else {
    parts.push('Scope: all files');
  }

  return parts.join(' · ');
};

/**
 * Escape a string for safe use as a markdown table cell. Pipes break tables, and
 * newlines collapse the row, so we replace both.
 */
const escapeTableCell = (s: string): string =>
  s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function buildTicketReply(input: TicketReplyInput): string {
  const maxLogs = input.maxLogs ?? 50;
  const maxPatterns = input.maxPatterns ?? 10;

  const lines: string[] = [];

  lines.push('## Log analysis');
  lines.push('');

  // Files
  const fileLabel = input.sourceType === 'har' ? 'HAR capture' : 'log file';
  const filesPlural = input.files.length === 1 ? fileLabel : `${fileLabel}s`;
  if (input.files.length > 0) {
    const names = input.files.map((f) => f.name).slice(0, 5).join(', ');
    const more = input.files.length > 5 ? `, +${input.files.length - 5} more` : '';
    lines.push(`**${input.files.length} ${filesPlural}:** ${names}${more}`);
  }

  // Date range across the filtered set
  const { from, to } = range(input.filteredLogs);
  if (from !== null && to !== null) {
    lines.push(`**Time range:** ${formatTs(from)} → ${formatTs(to)}`);
  }

  // Active filter
  const summary = filterSummary(input);
  if (summary) lines.push(`**Filter:** ${summary}`);

  lines.push('');

  // Counts
  if (input.sourceType === 'har' && input.harBuckets) {
    const b = input.harBuckets;
    lines.push(
      `**Status:** ${b['5xx']} × 5xx · ${b['4xx']} × 4xx · ${b['3xx']} × 3xx · ${b['2xx']} × 2xx · ${b['1xx']} × 1xx · ${b.other} × no response`,
    );
  } else {
    lines.push(
      `**Severity:** ${input.stats.error} errors · ${input.stats.warn} warnings · ${input.stats.info} info`,
    );
  }
  lines.push(
    `**Showing:** ${input.stats.filtered} of ${input.stats.total} entries match the active filter`,
  );

  // Top patterns
  if (input.patterns.length > 0) {
    lines.push('');
    lines.push(`### Top patterns (${Math.min(input.patterns.length, maxPatterns)})`);
    lines.push('');
    lines.push('| Count | Level | Pattern |');
    lines.push('|---:|---|---|');
    for (const p of input.patterns.slice(0, maxPatterns)) {
      const topLevel =
        p.logs.some((l) => l.level === 'error')
          ? 'error'
          : p.logs.some((l) => l.level === 'warn')
            ? 'warn'
            : 'info';
      lines.push(`| ${p.count} | ${topLevel} | ${escapeTableCell(p.pattern)} |`);
    }
  }

  // Workspace IDs (Desktop only — caller passes empty array for HAR)
  if (input.workspaceIds.length > 0) {
    lines.push('');
    lines.push(`### Workspace IDs (${input.workspaceIds.length})`);
    lines.push('');
    for (const id of input.workspaceIds) {
      lines.push(`- \`${id}\``);
    }
  }

  // Optional: the filtered logs themselves
  if (input.includeFilteredLogs && input.filteredLogs.length > 0) {
    const slice = input.filteredLogs.slice(0, maxLogs);
    lines.push('');
    lines.push(`### Log entries (${slice.length}${input.filteredLogs.length > maxLogs ? ` of ${input.filteredLogs.length}` : ''})`);
    lines.push('');
    lines.push('```');
    for (const log of slice) {
      const tag = input.sourceType === 'har' ? log.pid : log.level.toUpperCase();
      lines.push(`[${formatTs(log.timestamp)}] [${tag}] [${log.context}]`);
      lines.push(log.message);
      lines.push('');
    }
    lines.push('```');
    if (input.filteredLogs.length > maxLogs) {
      lines.push('');
      lines.push(`_…and ${input.filteredLogs.length - maxLogs} more entries hidden. Increase the cap or filter further before exporting._`);
    }
  }

  return lines.join('\n');
}

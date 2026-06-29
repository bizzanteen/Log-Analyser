export interface LogEntry {
  pid: string;
  timestamp: number;
  context: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  meta?: Record<string, unknown>;
}

export interface LogStats {
  info: number;
  warn: number;
  error: number;
  total: number;
  filtered: number;
}

export interface LogFile {
  id: string;
  name: string;
  logs: LogEntry[];
  source?: 'desktop' | 'har';
  /** Name of the file/archive the user uploaded (e.g. "logs.zip") for display */
  uploadedAs?: string;
}

// Parse a HAR file (HTTP Archive) into generic LogEntry items
// so it can flow through the existing log visualisation pipeline.
export const parseHarContent = (content: string): LogEntry[] => {
  try {
    const har = JSON.parse(content);
    const entries = har?.log?.entries ?? [];

    if (!Array.isArray(entries)) {
      return [];
    }

    return entries.map((entry: any, index: number): LogEntry => {
      const parsed = entry.startedDateTime ? Date.parse(entry.startedDateTime) : NaN;
      const started = Number.isFinite(parsed) ? parsed : Date.now();

      const request = entry.request ?? {};
      const response = entry.response ?? {};

      const method: string = request.method ?? 'GET';
      const url: string = request.url ?? `Entry ${index + 1}`;
      const status: number = response.status ?? 0;
      const statusText: string = response.statusText ?? '';
      const timeMs: number = typeof entry.time === 'number' ? entry.time : 0;

      let level: LogEntry['level'] = 'info';
      if (status >= 500) {
        level = 'error';
      } else if (status >= 400) {
        level = 'warn';
      }

      const sizeBytes =
        typeof response.bodySize === 'number'
          ? response.bodySize
          : typeof response.content?.size === 'number'
          ? response.content.size
          : undefined;

      const timingSummary = (() => {
        const t = entry.timings ?? {};
        const parts: string[] = [];
        if (typeof t.dns === 'number' && t.dns >= 0) parts.push(`DNS ${t.dns}ms`);
        if (typeof t.connect === 'number' && t.connect >= 0)
          parts.push(`Connect ${t.connect}ms`);
        if (typeof t.ssl === 'number' && t.ssl >= 0) parts.push(`SSL ${t.ssl}ms`);
        if (typeof t.wait === 'number' && t.wait >= 0) parts.push(`TTFB ${t.wait}ms`);
        if (typeof t.receive === 'number' && t.receive >= 0)
          parts.push(`Receive ${t.receive}ms`);
        return parts.length ? ` | ${parts.join(', ')}` : '';
      })();

      const sizePart =
        typeof sizeBytes === 'number' && sizeBytes >= 0
          ? ` | ${sizeBytes} bytes`
          : '';

      const safeStarted = Number.isFinite(started) ? started : Date.now();

      // Use just the host as context. The full URL is already rendered in the
      // message; putting it again in the metadata row was duplicating a long
      // string and forcing the metadata to wrap onto extra lines.
      let host = url;
      try {
        host = new URL(url).host || url;
      } catch {
        host = url;
      }

      return {
        pid: status ? String(status) : '-',
        timestamp: safeStarted,
        context: host,
        level,
        message: `${method} ${url} - ${status} ${statusText} (${timeMs}ms${sizePart}${timingSummary})`,
        meta: {
          statusCode: status,
          method,
          url,
          timeMs,
          startedAt: safeStarted,
        },
      };
    });
  } catch {
    return [];
  }
};

// Anchored regex: [pid][timestamp][context][level][message].
// The message field uses greedy `.*` so embedded `]` inside the message is preserved
// instead of being truncated at the first internal `]` like the previous non-greedy parser.
const LINE_REGEX = /^\[([^\]]+)\]\[([^\]]+)\]\[([^\]]+)\]\[([^\]]+)\]\[(.*)\]\s*$/;

const LEVEL_MAP: Record<string, LogEntry['level']> = {
  info: 'info',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
  err: 'error',
  fatal: 'error',
  debug: 'info',
  verbose: 'info',
  trace: 'info',
  silly: 'info',
};

const stripQuotes = (s: string): string =>
  s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"' ? s.slice(1, -1) : s;

export const parseLogLine = (line: string): LogEntry | null => {
  if (!line.trim()) return null;

  const match = LINE_REGEX.exec(line);
  if (!match) return null;

  const [, pid, timestampStr, context, levelStr, message] = match;

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) return null;

  const level = LEVEL_MAP[levelStr.toLowerCase()] ?? 'info';

  return {
    pid: stripQuotes(pid),
    timestamp,
    context: stripQuotes(context),
    level,
    message: stripQuotes(message),
  };
};

export const calculateLogStats = (allLogs: LogEntry[], filteredLogs: LogEntry[]): LogStats => {
  let info = 0;
  let warn = 0;
  let error = 0;
  for (const log of allLogs) {
    if (log.level === 'info') info++;
    else if (log.level === 'warn') warn++;
    else if (log.level === 'error') error++;
  }
  return { info, warn, error, total: allLogs.length, filtered: filteredLogs.length };
};

const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

export interface ExtractedIds {
  workspaceIds: string[];
}

export interface ExtractIdsOptions {
  /** When true, only include IDs that appear in log entries with level === 'error'. */
  errorsOnly?: boolean;
}

/** Character window before a UUID to look for "workspace" context. */
const UUID_CONTEXT_WINDOW = 100;

/**
 * Scans log entries and extracts workspace IDs (UUIDs that appear in context of
 * "workspace" in message/context). Classification uses the text *immediately
 * before* each UUID so an ID is only added when "workspace" appears before it
 * (e.g. "workspaceId: uuid" or "workspace uuid").
 * Returns only unique IDs (deduplicated via Set).
 * @param options.errorsOnly - When true, only consider error-level logs.
 */
export const extractWorkspaceIds = (
  logs: LogEntry[],
  options?: ExtractIdsOptions
): ExtractedIds => {
  const workspaceSet = new Set<string>();
  const toScan = options?.errorsOnly ? logs.filter((log) => log.level === 'error') : logs;

  for (const log of toScan) {
    const text = `${log.context} ${log.message}`;
    const lower = text.toLowerCase();

    for (const m of text.matchAll(UUID_REGEX)) {
      const id = m[0];
      const start = m.index ?? 0;
      const contextStart = Math.max(0, start - UUID_CONTEXT_WINDOW);
      const before = lower.slice(contextStart, start);

      if (before.includes('workspace')) workspaceSet.add(id);
    }
  }

  return {
    workspaceIds: [...workspaceSet].sort(),
  };
};

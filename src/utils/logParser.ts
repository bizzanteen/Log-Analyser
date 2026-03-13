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
      return {
        pid: status ? String(status) : '-',
        timestamp: safeStarted,
        context: url,
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

export const parseLogLine = (line: string): LogEntry | null => {
  if (!line.trim()) return null;

  const parts = line.match(/\[(.*?)\]/g);
  if (!parts || parts.length !== 5) return null;

  const [pid, timestamp, context, level, message] = parts.map(p => 
    p.slice(1, -1).replace(/^"|"$/g, '')
  );

  return {
    pid,
    timestamp: parseInt(timestamp),
    context,
    level: level.toLowerCase() as LogEntry['level'],
    message
  };
};

export const calculateLogStats = (allLogs: LogEntry[], filteredLogs: LogEntry[]): LogStats => {
  return {
    info: allLogs.filter(log => log.level === 'info').length,
    warn: allLogs.filter(log => log.level === 'warn').length,
    error: allLogs.filter(log => log.level === 'error').length,
    total: allLogs.length,
    filtered: filteredLogs.length
  };
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
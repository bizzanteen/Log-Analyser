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
      const started = entry.startedDateTime
        ? Date.parse(entry.startedDateTime)
        : Date.now();

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

      return {
        pid: status ? String(status) : '-',
        timestamp: Number.isFinite(started) ? started : Date.now(),
        context: url,
        level,
        message: `${method} ${url} - ${status} ${statusText} (${timeMs}ms${sizePart}${timingSummary})`,
        meta: {
          statusCode: status,
          method,
          url,
          timeMs,
          startedAt: started,
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
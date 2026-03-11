import { LogEntry } from '@/utils/logParser';
import { useMemo, useEffect } from 'react';

interface HarTimelineViewProps {
  logs: (LogEntry & { fileName?: string })[];
  selectedIndex?: number | null;
  /** Call with index to select a bar, or null to deselect (e.g. when clicking elsewhere) */
  onSelect?: (index: number | null) => void;
  /** When set and > 0, empty state is due to filter (no matches); otherwise no HAR loaded */
  unfilteredEntryCount?: number;
}

export const HarTimelineView = ({ logs, selectedIndex, onSelect, unfilteredEntryCount }: HarTimelineViewProps) => {
  const { items, minStart, totalSpanMs, numLanes } = useMemo(() => {
    type Item = {
      log: LogEntry & { fileName?: string };
      statusCode: number;
      timeMs: number;
      startedAt: number;
      bucket: string;
      lane: number;
      leftPct: number;
      widthPct: number;
    };
    if (!logs.length) {
      return { items: [] as Item[], minStart: 0, totalSpanMs: 1, numLanes: 0 };
    }

    const list = logs.map((log) => {
      const meta = (log.meta || {}) as {
        statusCode?: number;
        method?: string;
        url?: string;
        timeMs?: number;
        startedAt?: number;
      };

      const statusCode = typeof meta.statusCode === 'number' ? meta.statusCode : Number(log.pid);
      const timeMs =
        typeof meta.timeMs === 'number'
          ? meta.timeMs
          : (() => {
              const m = log.message.match(/\((\d+)ms/);
              return m ? parseInt(m[1], 10) : 0;
            })();

      const startedAt = typeof meta.startedAt === 'number' ? meta.startedAt : log.timestamp;

      let bucket: string = 'other';
      if (!Number.isNaN(statusCode)) {
        if (statusCode >= 500) bucket = '5xx';
        else if (statusCode >= 400) bucket = '4xx';
        else if (statusCode >= 300) bucket = '3xx';
        else if (statusCode >= 200) bucket = '2xx';
        else if (statusCode >= 100) bucket = '1xx';
      }

      return { log, statusCode, timeMs: timeMs || 1, startedAt, bucket };
    });

    const minStart = Math.min(...list.map((i) => i.startedAt));
    const maxEnd = Math.max(...list.map((i) => i.startedAt + i.timeMs));
    const totalSpanMs = Math.max(maxEnd - minStart, 1);

    const sortedByStart = [...list]
      .map((item, origIndex) => ({ item, origIndex }))
      .sort((a, b) => a.item.startedAt - b.item.startedAt);
    const laneEndTimes: number[] = [];
    const laneByOrigIndex: number[] = [];
    for (const { item, origIndex } of sortedByStart) {
      const endTime = item.startedAt + item.timeMs;
      let lane = 0;
      while (lane < laneEndTimes.length && item.startedAt < laneEndTimes[lane]) lane++;
      if (lane === laneEndTimes.length) laneEndTimes.push(0);
      laneByOrigIndex[origIndex] = lane;
      laneEndTimes[lane] = endTime;
    }

    const items = list.map((item, i) => ({
      ...item,
      lane: laneByOrigIndex[i],
      leftPct: ((item.startedAt - minStart) / totalSpanMs) * 100,
      widthPct: Math.max((item.timeMs / totalSpanMs) * 100, 0.5),
    }));

    const numLanes = Math.max(...laneByOrigIndex, 0) + 1;
    return { items, minStart, totalSpanMs, numLanes };
  }, [logs]);

  // Normal (dimmed when another bar is selected)
  const getColor = (bucket: string) => {
    switch (bucket) {
      case '1xx': return 'bg-blue-500';
      case '2xx': return 'bg-green-500';
      case '3xx': return 'bg-amber-500';
      case '4xx': return 'bg-orange-500';
      case '5xx': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  // Vivid (selected bar only – brighter/more saturated)
  const getColorVivid = (bucket: string) => {
    switch (bucket) {
      case '1xx': return 'bg-blue-400';
      case '2xx': return 'bg-green-400';
      case '3xx': return 'bg-amber-400';
      case '4xx': return 'bg-orange-400';
      case '5xx': return 'bg-red-400';
      default: return 'bg-gray-300';
    }
  };

  if (!items.length) {
    const isFilterEmpty = unfilteredEntryCount != null && unfilteredEntryCount > 0;
    if (isFilterEmpty) {
      return (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-4">
          No HAR entries to display for the selected filter.
        </div>
      );
    }
    return null;
  }

  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    pct: pct * 100,
    ms: Math.round(pct * totalSpanMs),
  }));

  const ROW_HEIGHT = 14;
  const trackHeight = numLanes * ROW_HEIGHT;
  const hasSelection = selectedIndex !== null;

  // Deselect when clicking anywhere on the page except a timeline bar
  useEffect(() => {
    if (selectedIndex === null || !onSelect) return;
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-har-timeline-bar]')) return;
      onSelect(null);
    };
    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [selectedIndex, onSelect]);

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        Request flow — main timeline at bottom; new lanes above when requests run at the same time. Click a bar to show only that request below.
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <div className="flex justify-between px-1 py-0.5 text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          {axisTicks.map(({ pct, ms }) => (
            <span key={pct} style={{ marginLeft: pct === 0 ? 0 : '-2px' }}>{ms} ms</span>
          ))}
        </div>

        <div
          className="relative w-full border-t border-gray-200 dark:border-gray-700 cursor-default"
          style={{ height: `${trackHeight}px` }}
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('button')) onSelect?.(null);
          }}
          role="presentation"
        >
          <div className="absolute inset-0 flex pointer-events-none" style={{ height: `${trackHeight}px` }}>
            {axisTicks.slice(0, -1).map(({ pct }) => (
              <div key={pct} className="border-r border-gray-200 dark:border-gray-700" style={{ width: '25%' }} />
            ))}
          </div>

          {Array.from({ length: numLanes }, (_, lane) => {
            const displayRow = numLanes - 1 - lane;
            const isMainLane = lane === 0;
            return (
              <div
                key={lane}
                className={`absolute left-0 right-0 flex items-center px-0.5 border-t border-gray-200 dark:border-gray-700 ${
                  isMainLane ? 'bg-blue-500/25 dark:bg-blue-400/30' : ''
                }`}
                style={{ top: `${displayRow * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
              >
                {items
                  .map((item, index) => ({ item, index }))
                  .filter(({ item: i }) => i.lane === lane)
                  .map(({ item, index }) => {
                    const isSelected = selectedIndex === index;
                    const colorClass = hasSelection && isSelected
                      ? getColorVivid(item.bucket)
                      : getColor(item.bucket);
                    // Inline styles only for selection/dimming so they always apply (no Tailwind dependency)
                    const opacity = hasSelection ? (isSelected ? 1 : 0.18) : 1;
                    const outlineStyle = isSelected
                      ? { boxShadow: '0 0 0 2px rgb(239 68 68)' } // red-500
                      : {};
                    return (
                      <button
                        key={index}
                        type="button"
                        data-har-timeline-bar
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect?.(index);
                        }}
                        className={`absolute h-2.5 rounded transition-all flex-shrink-0 ${colorClass}`}
                        style={{
                          left: `${item.leftPct}%`,
                          width: `${item.widthPct}%`,
                          minWidth: '3px',
                          opacity,
                          zIndex: isSelected ? 10 : undefined,
                          ...outlineStyle,
                        }}
                        title={`${item.statusCode} — ${item.timeMs} ms`}
                      />
                    );
                  })}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500" /> 1xx</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500" /> 2xx</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500" /> 3xx</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-500" /> 4xx</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" /> 5xx</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-gray-400" /> No response</span>
        </div>
      </div>
    </div>
  );
};

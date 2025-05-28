import { useState } from 'react';
import { ChevronDown, ChevronRight, Hash, Clock } from 'lucide-react';
import { PatternGroup } from '@/utils/patternMatcher';
import { LogEntry } from './LogEntry';

interface PatternViewProps {
  patterns: PatternGroup[];
}

export const PatternView = ({ patterns }: PatternViewProps) => {
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());

  const togglePattern = (pattern: string) => {
    const newExpanded = new Set(expandedPatterns);
    if (newExpanded.has(pattern)) {
      newExpanded.delete(pattern);
    } else {
      newExpanded.add(pattern);
    }
    setExpandedPatterns(newExpanded);
  };

  return (
    <div className="space-y-4">
      <div className="font-medium text-lg flex items-center gap-2">
        <Hash className="w-5 h-5" />
        Pattern Analysis
      </div>
      
      <div className="space-y-2">
        {patterns.map((group) => (
          <div key={group.pattern} className="border rounded-lg">
            <button
              onClick={() => togglePattern(group.pattern)}
              className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {expandedPatterns.has(group.pattern) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <div className="flex-1 text-left">
                <div className="font-mono text-sm truncate">
                  {group.pattern}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-4">
                  <span>
                    Occurrences: {group.count}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    First: {new Date(group.firstOccurrence).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last: {new Date(group.lastOccurrence).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
                {group.count}
              </div>
            </button>
            
            {expandedPatterns.has(group.pattern) && (
              <div className="border-t p-4 space-y-2">
                {group.logs.map((log, index) => (
                  <LogEntry key={index} log={log} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
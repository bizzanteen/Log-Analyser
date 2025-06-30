import React, { useState } from 'react';
import * as lucideReact from 'lucide-react';
import * as logParser from '@/utils/logParser';
import { tooltipMappings } from '@/utils/tooltipMappings';
import axios from 'axios';

interface LogEntryProps {
  log: logParser.LogEntry & { fileName?: string };
  conversation: string | undefined;
  showFileName?: boolean;
}

export const LogEntry = ({ log, conversation, showFileName = false }: LogEntryProps) => {
  const [bubble, setBubble] = useState<{ content: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const getIcon = () => {
    switch (log.level) {
      case 'error':
        return <lucideReact.AlertCircle className="w-4 h-4 text-red-500 cursor-pointer z-[100000]" onClick={handleIconClick} />;
      case 'warn':
        return <lucideReact.AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <lucideReact.Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (log.level) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900';
      case 'warn':
        return 'bg-yellow-50 dark:bg-yellow-900';
      default:
        return 'bg-gray-50 dark:bg-gray-800';
    }
  };

  const handleIconClick = async (event: React.MouseEvent) => {
    if (!conversation) return;
    setLoading(true);
    setBubble(null);

    try {
      const res = await axios.post('https://rabid-force-polish.flows.pstmn.io/api/default/query-log', {
        conversation,
        log: log.message,
      });
      setBubble({ content: res.data });
    } catch (e) {
      setBubble({ content: 'Error fetching response' });
    } finally {
      setLoading(false);
    }
  };

  const formatMessage = (message: string) => {
    try {
      if (message.startsWith('{') || message.startsWith('[')) {
        const parsed = JSON.parse(message);
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      console.log("No JSON conversion - Test");
    }
    return message;
  };

  // Check if the log message matches any tooltip pattern
  const tooltip = Object.keys(tooltipMappings).find((pattern) =>
    log.message.includes(pattern)
  );

  return (
    <div className={`p-4 rounded-lg ${getBgColor()}`}>
      <div className="flex items-start gap-2 relative">
        {getIcon()}
        <div className="flex-1 font-mono text-sm whitespace-pre-wrap">
          {log.message}
        </div>
        {tooltip && (
          <div className="relative group">
            <div className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-700 rounded-full cursor-pointer">
              ℹ
            </div>
            <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-black text-white text-xs p-2 rounded shadow-lg z-10 inline-block max-w-xs whitespace-nowrap">
              {tooltipMappings[tooltip]}
            </div>
          </div>
        )}
        {loading && (
          <div className="ml-2 text-xs text-gray-400">Loading...</div>
        )}
        {bubble && log.level === 'error' && (
          <div
            className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center z-[100000] pointer-events-auto"
            onClick={() => setBubble(null)}
            style={{ background: 'rgba(0,0,0,0.01)' }}
          >
            <div
              className="relative pointer-events-auto bg-card text-card-foreground rounded-xl px-4 py-3 shadow-lg z-[100000] backdrop-blur-md bg-opacity-80"
              style={{ width: 'fit-content', maxWidth: '90%' }}
              onClick={(e) => e.stopPropagation()}
            >
              {bubble.content}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-300 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <lucideReact.Clock className="w-3 h-3" />
          <span>{new Date(log.timestamp).toLocaleString()}</span>
        </div>
        <span className="text-gray-400">|</span>
        <span className="font-mono">PID: {log.pid}</span>
        <span className="text-gray-400">|</span>
        <span className="font-mono">{log.context}</span>
        {showFileName && log.fileName && (
          <>
            <span className="text-gray-400">|</span>
            <span className="font-mono text-blue-600 dark:text-blue-400">{log.fileName}</span>
          </>
        )}
      </div>
    </div>
  );
};

/* Add to global CSS (src/app/globals.css):
.speech-bubble-modal {
  position: relative;
  z-index: 9999;
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.10), 0 1.5px 4px 0 rgba(0,0,0,0.10);
}
.speech-bubble-modal-arrow {
  position: absolute;
  left: -18px;
  top: 18px;
  width: 0;
  height: 0;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-right: 18px solid var(--card);
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.08));
  content: '';
  display: block;
}
.dark .speech-bubble-modal {
  background: #23272f;
  color: #fff;
}
.dark .speech-bubble-modal-arrow {
  border-right-color: #23272f;
}
*/
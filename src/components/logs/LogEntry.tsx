import * as lucideReact from 'lucide-react';
import * as logParser from '@/utils/logParser';
import { tooltipMappings } from '@/utils/tooltipMappings'; // Import tooltip mappings

interface LogEntryProps {
  log: logParser.LogEntry;
}

export const LogEntry = ({ log }: LogEntryProps) => {
  const getIcon = () => {
    switch (log.level) {
      case 'error':
        return <lucideReact.AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warn':
        return <lucideReact.AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <lucideReact.Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (log.level) {
      case 'error':
        return 'bg-red-50';
      case 'warn':
        return 'bg-yellow-50';
      default:
        return 'bg-gray-50';
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
      <div className="flex items-start gap-2">
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
      </div>
      <div className="mt-2 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <lucideReact.Clock className="w-3 h-3" />
          <span>{new Date(log.timestamp).toLocaleString()}</span>
        </div>
        <span className="text-gray-400">|</span>
        <span className="font-mono">PID: {log.pid}</span>
        <span className="text-gray-400">|</span>
        <span className="font-mono">{log.context}</span>
      </div>
    </div>
  );
};
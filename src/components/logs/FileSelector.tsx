import React, { useMemo } from 'react';
import { LogFile } from '@/utils/logParser';

interface FileSelectorProps {
  files: LogFile[];
  selectedFileId: string | null;
  onFileSelect: (id: string) => void;
  removeFile: (id: string) => void; // New prop for removing files
  searchScope: 'current' | 'all';
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  files,
  selectedFileId,
  onFileSelect,
  removeFile,
  searchScope,
}) => {
  const memoizedFiles = useMemo(() => files, [files]);

  return (
    <div className="flex flex-wrap gap-2">
      {memoizedFiles.map((file) => (
        <div
          key={file.id}
          className={`flex items-center gap-2 px-3 py-1 rounded-full cursor-pointer mb-2 border-none ${
            searchScope === 'all' || selectedFileId === file.id
              ? 'bg-postman-100 dark:bg-postman-700 text-postman-700 dark:text-postman-100'
              : 'bg-gray-100 dark:bg-stone-800 text-gray-700 dark:text-stone-200'
          }`}
          onClick={() => onFileSelect(file.id)}
        >
          <span className="truncate">{file.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering file selection
              removeFile(file.id); // Call the removeFile callback
            }}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white transition-colors"
            title="Remove file"
            aria-label="Remove file"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};
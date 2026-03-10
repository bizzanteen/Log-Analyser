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
              ? 'bg-blue-100 dark:bg-[#1d4ed8] text-blue-700 dark:text-blue-200'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
          }`}
          onClick={() => onFileSelect(file.id)}
        >
          <span className="truncate">{file.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering file selection
              removeFile(file.id); // Call the removeFile callback
            }}
            className="text-red-500 hover:text-red-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};
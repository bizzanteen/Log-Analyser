import { Search, Globe, AlertTriangle, AlertCircle, ArrowUpDown, Info } from 'lucide-react';
import { LogEntry } from '@/utils/logParser';

interface LogFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortDirection: 'asc' | 'desc';
  setSortDirection: (direction: 'asc' | 'desc') => void;
}

export const LogFilters = ({
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  sortDirection,
  setSortDirection
}: LogFiltersProps) => {
  return (
    <div className="space-y-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search in messages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
          className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 flex items-center gap-2"
          title="Sort by date"
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortDirection === 'asc' ? 'Newest First' : 'Oldest First'}
        </button>
        <div className="w-px h-6 bg-gray-300 mx-2" />
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded flex items-center gap-2 ${filter === 'all' ? 'bg-green-500 text-white dark:bg-green-700' : 'bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-300'}`}
        >
          <Globe className="w-4 h-4" /> All
        </button>
        <button
          onClick={() => setFilter('info')}
          className={`px-4 py-2 rounded flex items-center gap-2 ${filter === 'info' ? 'bg-blue-500 text-white dark:bg-blue-700' : 'bg-gray-100 dark:bg-gray-800 text-blue-700 dark:text-blue-300'}`}
        >
          <Info className="w-4 h-4" /> Info
        </button>
        <button
          onClick={() => setFilter('warn')}
          className={`px-4 py-2 rounded flex items-center gap-2 ${filter === 'warn' ? 'bg-yellow-500 text-white dark:bg-yellow-700' : 'bg-gray-100 dark:bg-gray-800 text-yellow-700 dark:text-yellow-300'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Warnings
        </button>
        <button
          onClick={() => setFilter('error')}
          className={`px-4 py-2 rounded flex items-center gap-2 ${filter === 'error' ? 'bg-red-500 text-white dark:bg-red-700' : 'bg-gray-100 dark:bg-gray-800 text-red-700 dark:text-red-300'}`}
        >
          <AlertCircle className="w-4 h-4" /> Errors
        </button>
      </div>
    </div>
  );
};
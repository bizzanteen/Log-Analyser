import { Search, Globe, AlertTriangle, AlertCircle, ArrowUpDown, Info, X, File, Files, Calendar } from 'lucide-react';
import { LogEntry } from '@/utils/logParser';
import { useState } from 'react';

interface LogFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchTerms: string[];
  setSearchTerms: (terms: string[]) => void;
  searchScope: 'current' | 'all';
  setSearchScope: (scope: 'current' | 'all') => void;
  sortDirection: 'asc' | 'desc';
  setSortDirection: (direction: 'asc' | 'desc') => void;
  dateRange: { start: string; end: string };
  setDateRange: (range: { start: string; end: string }) => void;
}

export const LogFilters = ({
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  searchTerms,
  setSearchTerms,
  searchScope,
  setSearchScope,
  sortDirection,
  setSortDirection,
  dateRange,
  setDateRange
}: LogFiltersProps) => {
  const [tempSearchInput, setTempSearchInput] = useState('');

  const handleSearchInputChange = (value: string) => {
    setTempSearchInput(value);
    setSearchTerm(value);
  };

  const handleStartDateChange = (value: string) => {
    const newDateRange = { ...(dateRange || { start: '', end: '' }), start: value };
    
    // If the new start date is after the current end date, clear the end date
    if (dateRange?.end && value && new Date(value) > new Date(dateRange.end)) {
      newDateRange.end = '';
    }
    
    setDateRange(newDateRange);
  };

  const handleEndDateChange = (value: string) => {
    setDateRange({ ...(dateRange || { start: '', end: '' }), end: value });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (tempSearchInput.trim()) {
        const newTerms = [...searchTerms, tempSearchInput.trim()];
        setSearchTerms(newTerms);
        setTempSearchInput('');
        setSearchTerm('');
      }
    } else if (e.key === 'Backspace' && tempSearchInput === '' && searchTerms.length > 0) {
      // Remove last tag when backspacing on empty input
      const newTerms = [...searchTerms];
      newTerms.pop();
      setSearchTerms(newTerms);
    }
  };

  const removeSearchTerm = (indexToRemove: number) => {
    const newTerms = searchTerms.filter((_, index) => index !== indexToRemove);
    setSearchTerms(newTerms);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const clearDateRange = () => {
    setDateRange({ start: '', end: '' });
  };

  return (
    <div className="space-y-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      {/* Search Input with Tags */}
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-500" />
        <div className="flex-1 flex items-center gap-2 p-2 border rounded bg-white dark:bg-gray-900 min-h-[40px] flex-wrap">
          {/* Search Tags */}
          {searchTerms.map((term, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
            >
              {term}
              <button
                onClick={() => removeSearchTerm(index)}
                className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {/* Search Input */}
          <input
            type="text"
            placeholder={searchTerms.length === 0 ? "Enter search terms separated by comma" : ""}
            value={tempSearchInput}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="flex-1 min-w-[200px] outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2 relative">
        <Calendar className="w-4 h-4 text-gray-500" />
        <div className="flex items-center gap-2 flex-1">
          <input
            type="date"
            value={dateRange?.start || ''}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="px-3 py-2 border rounded bg-white dark:bg-gray-900 text-sm"
            placeholder="Start date"
            title="Select start date"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange?.end || ''}
            min={dateRange?.start || ''}
            onChange={(e) => handleEndDateChange(e.target.value)}
            className={`px-3 py-2 border rounded bg-white dark:bg-gray-900 text-sm ${
              dateRange?.start ? 'border-blue-300 dark:border-blue-600' : ''
            }`}
            placeholder="End date"
            title={dateRange?.start ? `Select end date (must be after ${new Date(dateRange.start).toLocaleDateString()})` : "Select end date"}
          />
          {(dateRange?.start || dateRange?.end) && (
            <button
              onClick={clearDateRange}
              className="px-2 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Clear date filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex gap-2 items-center">
        {/* Sort Button */}
        <button
          onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
          className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700 flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600"
          title="Sort by date"
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortDirection === 'desc' ? 'Newest First' : 'Oldest First'}
        </button>

        {/* Search Scope Toggle */}
        <div className="flex rounded border bg-white dark:bg-gray-900">
          <button
            onClick={() => setSearchScope('current')}
            className={`px-3 py-2 rounded-l flex items-center gap-2 text-sm ${
              searchScope === 'current' 
                ? 'bg-blue-500 text-white dark:bg-blue-600' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <File className="w-4 h-4" />
            Current File
          </button>
          <button
            onClick={() => setSearchScope('all')}
            className={`px-3 py-2 rounded-r flex items-center gap-2 text-sm ${
              searchScope === 'all' 
                ? 'bg-blue-500 text-white dark:bg-blue-600' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Files className="w-4 h-4" />
            All Files
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Filter Buttons */}
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded flex items-center gap-2 ${filter === 'all' ? 'bg-green-500 text-white dark:bg-green-700' : 'bg-gray-100 dark:bg-gray-700 text-green-700 dark:text-green-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          <Globe className="w-4 h-4" /> All
        </button>
        <button
          onClick={() => setFilter('info')}
          className={`px-4 py-2 rounded flex items-center gap-2 ${filter === 'info' ? 'bg-blue-500 text-white dark:bg-blue-700' : 'bg-gray-100 dark:bg-gray-700 text-blue-700 dark:text-blue-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          <Info className="w-4 h-4" /> Info
        </button>
        <button
          onClick={() => setFilter('warn')}
          className={`px-4 py-2 rounded flex items-center gap-2 ${filter === 'warn' ? 'bg-yellow-500 text-white dark:bg-yellow-700' : 'bg-gray-100 dark:bg-gray-700 text-yellow-700 dark:text-yellow-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Warnings
        </button>
        <button
          onClick={() => setFilter('error')}
          className={`px-4 py-2 rounded flex items-center gap-2 ${filter === 'error' ? 'bg-red-500 text-white dark:bg-red-700' : 'bg-gray-100 dark:bg-gray-700 text-red-700 dark:text-red-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          <AlertCircle className="w-4 h-4" /> Errors
        </button>
      </div>
    </div>
  );
};
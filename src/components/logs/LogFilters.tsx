import { Search, Globe, AlertTriangle, AlertCircle, ArrowUpDown, Info, X, File, Files, Calendar } from 'lucide-react';
import { LogEntry } from '@/utils/logParser';
import { useState } from 'react';

interface LogFiltersProps {
  filter: string | string[];
  setFilter: (filter: string | string[]) => void;
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
  showScopeToggle?: boolean;
  showDateFilter?: boolean;
  isHarView?: boolean;
  conversationData?: string | string[];
  onApplyAISearch?: () => void;
  aiSearchTerms?: string[]; // Track which terms came from AI
  isAISearchActive?: boolean; // Track if AI search is currently active
  aiSearchState?: 'disabled' | 'loading' | 'ready'; // Track AI search button state
  onClearAllSearchTerms?: () => void; // Function to clear all search terms
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
  setDateRange,
  conversationData,
  onApplyAISearch,
  aiSearchTerms = [],
  isAISearchActive = false,
  aiSearchState = 'disabled',
  onClearAllSearchTerms,
  showScopeToggle = true,
  showDateFilter = true,
  isHarView = false,
}: LogFiltersProps) => {
  const [tempSearchInput, setTempSearchInput] = useState('');

  // Ensure filter is always an array for easier processing
  const selectedFilters = Array.isArray(filter) ? filter : [filter];

  const HAR_BUCKETS = ['1xx', '2xx', '3xx', '4xx', '5xx', 'other'] as const;

  const handleFilterToggle = (filterType: string) => {
    // In HAR view, multi-select buckets (like desktop Error/Warn/Info)
    if (isHarView) {
      if (filterType === 'all') {
        setFilter('all');
        return;
      }
      const currentFilters = Array.isArray(filter) ? filter : (filter === 'all' ? [] : [filter]);
      if (currentFilters.includes(filterType)) {
        const newFilters = currentFilters.filter(f => f !== filterType);
        setFilter(newFilters.length === 0 ? 'all' : newFilters);
      } else {
        const newFilters = [...currentFilters.filter(f => f !== 'all'), filterType];
        if (newFilters.length === HAR_BUCKETS.length && HAR_BUCKETS.every(b => newFilters.includes(b))) {
          setFilter('all');
        } else {
          setFilter(newFilters);
        }
      }
      return;
    }

    if (filterType === 'all') {
      setFilter('all');
      return;
    }

    const currentFilters = Array.isArray(filter) ? filter : (filter === 'all' ? [] : [filter]);
    
    if (currentFilters.includes(filterType)) {
      // Remove the filter if it's already selected
      const newFilters = currentFilters.filter(f => f !== filterType);
      setFilter(newFilters.length === 0 ? 'all' : newFilters);
    } else {
      // Add the filter if it's not selected
      const newFilters = [...currentFilters.filter(f => f !== 'all'), filterType];
      
      // If all three log levels are selected, switch to "All"
      if (newFilters.length === 3 && newFilters.includes('info') && newFilters.includes('warn') && newFilters.includes('error')) {
        setFilter('all');
      } else {
        setFilter(newFilters);
      }
    }
  };

  const isFilterActive = (filterType: string) => {
    if (filterType === 'all') {
      return filter === 'all';
    }
    return selectedFilters.includes(filterType);
  };

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
        <div className="flex-1 flex items-start gap-2 p-2 border rounded bg-white dark:bg-gray-900 min-h-[48px] flex-wrap">
          {/* Search Tags */}
          {searchTerms.map((term, index) => {
            const isAITerm = aiSearchTerms.includes(term);
            return (
              <span
                key={index}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                  isAITerm 
                    ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                    : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                }`}
              >
                {term}
                <button
                  onClick={() => removeSearchTerm(index)}
                  className={`rounded-full p-0.5 ${
                    isAITerm
                      ? 'hover:bg-purple-200 dark:hover:bg-purple-800'
                      : 'hover:bg-blue-200 dark:hover:bg-blue-800'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          {/* Search Input */}
          <input
            type="text"
            placeholder={searchTerms.length === 0 ? "Enter search terms separated by comma" : ""}
            value={tempSearchInput}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="flex-1 min-w-[200px] outline-none bg-transparent placeholder:italic"
          />
        </div>
        {/* Clear All Button */}
        {searchTerms.length > 0 && onClearAllSearchTerms && (
          <button
            onClick={onClearAllSearchTerms}
            className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 whitespace-nowrap"
            title="Clear all search terms"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Date Filter */}
      {showDateFilter && (
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
      )}

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



        {/* Search Scope Toggle (optional, e.g. hidden for HAR view) */}
        {showScopeToggle && (
          <>
            <div className="flex rounded border bg-white dark:bg-gray-900">
              <button
                onClick={() => setSearchScope('all')}
                className={`px-4 py-2 rounded-l flex items-center gap-2 ${
                  searchScope === 'all' 
                    ? 'bg-blue-500 text-white dark:bg-blue-600' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Files className="w-4 h-4" />
                All Files
              </button>
              <button
                onClick={() => setSearchScope('current')}
                className={`px-4 py-2 rounded-r flex items-center gap-2 ${
                  searchScope === 'current' 
                    ? 'bg-blue-500 text-white dark:bg-blue-600' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <File className="w-4 h-4" />
                Current File
              </button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-2" />
          </>
        )}

        {/* Filter Buttons */}
        {isHarView ? (
          <>
            <button
              onClick={() => handleFilterToggle('all')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('all') ? 'bg-green-500 text-white dark:bg-green-700' : 'bg-gray-100 dark:bg-gray-700 text-green-700 dark:text-green-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <Globe className="w-4 h-4" /> All
            </button>
            <button
              onClick={() => handleFilterToggle('1xx')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('1xx') ? 'bg-blue-500 text-white dark:bg-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-blue-700 dark:text-blue-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              1xx
            </button>
            <button
              onClick={() => handleFilterToggle('2xx')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('2xx') ? 'bg-green-500 text-white dark:bg-green-600' : 'bg-gray-100 dark:bg-gray-700 text-green-700 dark:text-green-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              2xx
            </button>
            <button
              onClick={() => handleFilterToggle('3xx')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('3xx') ? 'bg-amber-500 text-white dark:bg-amber-600' : 'bg-gray-100 dark:bg-gray-700 text-amber-700 dark:text-amber-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              3xx
            </button>
            <button
              onClick={() => handleFilterToggle('4xx')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('4xx') ? 'bg-orange-500 text-white dark:bg-orange-600' : 'bg-gray-100 dark:bg-gray-700 text-orange-700 dark:text-orange-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              4xx
            </button>
            <button
              onClick={() => handleFilterToggle('5xx')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('5xx') ? 'bg-red-500 text-white dark:bg-red-600' : 'bg-gray-100 dark:bg-gray-700 text-red-700 dark:text-red-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              5xx
            </button>
            <button
              onClick={() => handleFilterToggle('other')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('other') ? 'bg-gray-500 text-white dark:bg-gray-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              No response
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleFilterToggle('all')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('all') ? 'bg-green-500 text-white dark:bg-green-700' : 'bg-gray-100 dark:bg-gray-700 text-green-700 dark:text-green-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <Globe className="w-4 h-4" /> All
            </button>
            <button
              onClick={() => handleFilterToggle('error')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('error') ? 'bg-red-500 text-white dark:bg-red-700' : 'bg-gray-100 dark:bg-gray-700 text-red-700 dark:text-red-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <AlertCircle className="w-4 h-4" /> Errors
            </button>
            <button
              onClick={() => handleFilterToggle('warn')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('warn') ? 'bg-yellow-500 text-white dark:bg-yellow-700' : 'bg-gray-100 dark:bg-gray-700 text-yellow-700 dark:text-yellow-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <AlertTriangle className="w-4 h-4" /> Warnings
            </button>
            <button
              onClick={() => handleFilterToggle('info')}
              className={`px-4 py-2 rounded flex items-center gap-2 ${isFilterActive('info') ? 'bg-blue-500 text-white dark:bg-blue-700' : 'bg-gray-100 dark:bg-gray-700 text-blue-700 dark:text-blue-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <Info className="w-4 h-4" /> Info
            </button>
          </>
        )}
      </div>
    </div>
  );
};
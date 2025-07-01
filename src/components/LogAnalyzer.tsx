'use client'

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LogEntry as LogEntryType, LogFile, parseLogLine, calculateLogStats } from '../utils/logParser';
import { LogEntry } from './logs/LogEntry';
import { LogFilters } from './logs/LogFilters';
import { LogStats } from './logs/LogStats';
import { FileSelector } from './logs/FileSelector';
import { PatternView } from './logs/PatternView';
import { findPatterns } from '../utils/patternMatcher';
import { Plus, X, Copy, Check } from 'lucide-react';
import JSZip from 'jszip';
import { ThemeToggle } from "./theme-toggle";
import axios from 'axios';

interface Tab {
  id: string;
  name: string;
  files: LogFile[];
  selectedFileId: string | null;
  filter: string | string[];
  searchTerm: string;
  searchTerms: string[]; // Array of search terms for tag display
  searchScope: 'current' | 'all'; // New property for search scope
  dateRange: { start: string; end: string }; // Date filter range
  sortDirection: 'asc' | 'desc';
  viewMode: 'logs' | 'patterns';
  response?: string | string[]; // Added optional property for storing response
  aiSearchTerms?: string[]; // Track which terms came from AI
  isAISearchActive?: boolean; // Track if AI search is currently active
  aiSearchState?: 'disabled' | 'loading' | 'ready'; // Track AI search button state
}

const LogAnalyzer = () => {
  const [tabs, setTabs] = useState<Tab[]>([{
    id: crypto.randomUUID(),
    name: 'Ticket 1',
    files: [],
    selectedFileId: null,
    filter: 'all',
    searchTerm: '',
    searchTerms: [], // Initialize as empty array
    searchScope: 'current', // Default search scope
    dateRange: { start: '', end: '' }, // Initialize date range
    sortDirection: 'desc',
    viewMode: 'logs',
    aiSearchTerms: [], // Initialize AI search terms
    isAISearchActive: false, // Initialize AI search state
    aiSearchState: 'disabled', // Initialize as disabled
  }]); // Ensure at least one tab is always initialized

  const [activeTabId, setActiveTabId] = useState<string | null>(tabs.length > 0 ? tabs[0].id : null); // Safeguard against empty tabs array
  const [editingTabId, setEditingTabId] = useState<string | null>(null); // ID of the tab being renamed
  const [tempTabName, setTempTabName] = useState<string>(''); // Temporary name for the tab being edited
  const [currentPage, setCurrentPage] = useState(1); // Track the current page
  const [pageInput, setPageInput] = useState(''); // Input for jumping to specific page
  const [copyAllCopied, setCopyAllCopied] = useState(false); // State for copy button animation
  const logsPerPage = 50; // Maximum logs per page

  // Add a new tab
  const addTab = () => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      name: `Ticket ${tabs.length + 1}`,
      files: [],
      selectedFileId: null,
      filter: 'all',
      searchTerm: '',
      searchTerms: [], // Initialize as empty array
      searchScope: 'current', // Default search scope
      dateRange: { start: '', end: '' }, // Initialize date range
      sortDirection: 'desc',
      viewMode: 'logs',
      aiSearchTerms: [], // Initialize AI search terms
      isAISearchActive: false, // Initialize AI search state
      aiSearchState: 'disabled', // Initialize as disabled
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id); // Set the new tab as active
  };

  // Remove a tab
  const removeTab = (id: string) => {
    setTabs((prev) => prev.filter((tab) => tab.id !== id));
    if (activeTabId === id) {
      setActiveTabId(tabs.length > 1 ? tabs[0].id : null); // Switch to the first tab or null if no tabs remain
    }
  };

  // Start renaming a tab
  const startRenamingTab = (id: string) => {
    setEditingTabId(id);
    setTempTabName(''); // Clear the temporary name to always show the placeholder
  };

  // Save the renamed tab
  const saveRenamedTab = async () => {
    if (editingTabId) {
      const currentEditingTabId = editingTabId;
      if (tempTabName.trim() === '') {
        // Restore the original name if no changes were made
        const originalName = tabs.find((tab) => tab.id === currentEditingTabId)?.name || '';
        setTabs((prev) =>
          prev.map((tab) => (tab.id === currentEditingTabId ? { ...tab, name: originalName } : tab))
        );
        setEditingTabId(null);
        setTempTabName('');
        return;
      }
      // Always update the tab name and clear previous response
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === currentEditingTabId
            ? { 
                ...tab, 
                name: tempTabName, 
                response: undefined,
                aiSearchTerms: [],
                isAISearchActive: false,
                aiSearchState: tempTabName.trim() ? 'loading' : 'disabled' // Set to loading if ticket number provided
              }
            : tab
        )
      );
      setEditingTabId(null);
      setTempTabName('');
      
      // Only run API request if we have a ticket number
      if (tempTabName.trim() === '') {
        return;
      }
      
      // Run the HTTP request for the new ticket number
      try {
        console.log('Making API request for ticket:', tempTabName);
        const response = await axios.get(
          `https://rabid-force-polish.flows.pstmn.io/api/default/get-summary?ticket_id=${tempTabName}`,
          {
            headers: {
              Authorization:
                'Basic ZWFtb24uY3VsbGVuK2QzdkBwb3N0bWFuLmNvbS90b2tlbjplZXdVQ2loemV6UjYya0lzMXNUaFhBbFQybnpKWGhPbThHT3JzNG1j',
            },
          }
        );
        console.log('API response received:', response.data);
        console.log('Response type:', typeof response.data);
        console.log('Is array:', Array.isArray(response.data));
        console.log('Response length:', response.data?.length);
        console.log('Response truthy:', !!response.data);
        console.log('Response as JSON:', JSON.stringify(response.data));
        console.log('Full response object:', response);
        
        // Handle different response formats
        let conversationData = null;
        
        if (response.data) {
          if (typeof response.data === 'string' && response.data.trim().length > 0) {
            conversationData = response.data.trim();
            console.log('Valid string response found:', conversationData);
          } else if (Array.isArray(response.data) && response.data.length > 0) {
            conversationData = response.data;
            console.log('Valid array response found:', conversationData);
          } else {
            console.log('Invalid response - empty string or array');
          }
        } else {
          console.log('No response.data found');
        }
        
        if (conversationData) {
          console.log('Valid response format found - storing conversation data and auto-applying AI search');
          
          // Parse AI terms from the response
          let aiTerms: string[] = [];
          if (typeof conversationData === 'string') {
            aiTerms = conversationData
              .split(',')
              .map(term => term.trim())
              .filter(term => term.length > 0);
          } else if (Array.isArray(conversationData)) {
            aiTerms = conversationData
              .map(term => String(term).trim())
              .filter(term => term.length > 0);
          }
          
          // Get current tab to preserve existing search terms
          const currentTab = tabs.find(tab => tab.id === currentEditingTabId);
          const existingUserTerms = currentTab?.searchTerms || [];
          
          // Merge existing user terms with new AI terms (avoid duplicates)
          const mergedTerms = [...existingUserTerms];
          aiTerms.forEach(term => {
            if (!mergedTerms.includes(term)) {
              mergedTerms.push(term);
            }
          });
          
          setTabs((prevTabs) =>
            prevTabs.map((tab) =>
              tab.id === currentEditingTabId
                ? { 
                    ...tab, 
                    response: conversationData, 
                    aiSearchState: 'ready',
                    searchTerms: mergedTerms, // Preserve existing + add AI terms
                    aiSearchTerms: aiTerms,
                    isAISearchActive: true
                  }
                : tab
            )
          );
        } else {
          console.log('Invalid response format - setting disabled state');
          setTabs((prevTabs) =>
            prevTabs.map((tab) =>
              tab.id === currentEditingTabId
                ? { ...tab, response: undefined, aiSearchState: 'disabled' }
                : tab
            )
          );
        }
      } catch (error) {
        console.error('API request failed:', error);
        setTabs((prevTabs) =>
          prevTabs.map((tab) =>
            tab.id === currentEditingTabId
              ? { ...tab, response: undefined, aiSearchState: 'disabled' }
              : tab
          )
        );
      }
    }
  };

  // Handle file uploads for the active tab
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTabId) return; // Exit if no active tab
    const fileList = event.target.files;
    if (!fileList) return;

    try {
      const newFiles: LogFile[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        if (fileExtension === 'zip') {
          // Handle .zip files
          const zip = new JSZip();
          const zipContents = await zip.loadAsync(file);
          for (const filename in zipContents.files) {
            const fileData = await zipContents.files[filename].async('string');
            const lines = fileData.split('\n');
            const parsedLogs = lines
              .map((line, index) => {
                const log = parseLogLine(line);
                if (!log) {
                  console.warn(`Failed to parse line ${index} in ${filename}:`, line);
                }
                return log;
              })
              .filter((log): log is LogEntryType => log !== null);

            newFiles.push({
              id: crypto.randomUUID(),
              name: filename,
              logs: parsedLogs,
            });
          }
        } else {
          // Handle normal files
          const text = await file.text();
          const lines = text.split('\n');
          const parsedLogs = lines
            .map((line, index) => {
              const log = parseLogLine(line);
              if (!log) {
                console.warn(`Failed to parse line ${index} in ${file.name}:`, line);
              }
              return log;
            })
            .filter((log): log is LogEntryType => log !== null);

          newFiles.push({
            id: crypto.randomUUID(),
            name: file.name,
            logs: parsedLogs,
          });
        }
      }

      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                files: [...tab.files, ...newFiles],
                selectedFileId: tab.selectedFileId || newFiles[0]?.id || null,
              }
            : tab
        )
      );
    } catch (error) {
      console.error('Error processing files:', error);
    }
  };

  // Get the active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  // Get logs based on search scope (current file or all files)
  const currentLogs = activeTab?.searchScope === 'all' 
    ? activeTab.files.flatMap(file => file.logs.map(log => ({ ...log, fileName: file.name })))
    : (activeTab?.files.find((file) => file.id === activeTab?.selectedFileId)?.logs || []);

  // Filter and sort the logs based on the active tab's state
  const filteredAndSortedLogs = currentLogs
    .filter((log) => {
      // Handle both single filter and multiple filter combinations
      const filter = activeTab?.filter;
      let levelMatch = false;
      
      if (filter === 'all') {
        levelMatch = true;
      } else if (Array.isArray(filter)) {
        // Multiple filters selected - log matches if it's any of the selected levels
        levelMatch = filter.length === 0 || filter.includes(log.level);
      } else {
        // Single filter selected
        levelMatch = log.level === filter;
      }
      
      // Handle multi-term OR search
      const searchTerms = activeTab?.searchTerms || [];
      const searchMatch = searchTerms.length === 0 || searchTerms.some(term =>
        log.message.toLowerCase().includes(term.toLowerCase()) ||
        log.context.toLowerCase().includes(term.toLowerCase())
      );
      
      // Handle date range filtering
      const dateRange = activeTab?.dateRange;
      let dateMatch = true;
      if (dateRange && (dateRange.start || dateRange.end)) {
        const logDate = new Date(log.timestamp);
        const logDateString = logDate.toISOString().split('T')[0]; // Get YYYY-MM-DD format
        
        if (dateRange.start && logDateString < dateRange.start) {
          dateMatch = false;
        }
        if (dateRange.end && logDateString > dateRange.end) {
          dateMatch = false;
        }
      }
      
      return levelMatch && searchMatch && dateMatch;
    })
    .sort((a, b) => {
      const sortMultiplier = activeTab?.sortDirection === 'asc' ? 1 : -1;
      return (a.timestamp - b.timestamp) * sortMultiplier;
    });

  // Calculate statistics for the logs
  const stats = calculateLogStats(currentLogs, filteredAndSortedLogs);

  // Calculate the logs to display for the current page
  const paginatedLogs = filteredAndSortedLogs.slice(
    (currentPage - 1) * logsPerPage,
    currentPage * logsPerPage
  );

  // Calculate total pages
  const totalPages = Math.ceil(filteredAndSortedLogs.length / logsPerPage);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Calculate pagination range
  const getPaginationRange = (current: number, total: number) => {
    const maxVisible = 10;
    const sidePages = Math.floor((maxVisible - 1) / 2);
    
    let start = Math.max(1, current - sidePages);
    let end = Math.min(total, current + sidePages);
    
    // Adjust if we're near the beginning or end
    if (end - start + 1 < maxVisible) {
      if (start === 1) {
        end = Math.min(total, start + maxVisible - 1);
      } else if (end === total) {
        start = Math.max(1, end - maxVisible + 1);
      }
    }
    
    return { start, end };
  };

  // Handle page input
  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      handlePageChange(page);
      setPageInput('');
    }
  };

  // Copy all filtered logs to clipboard
  const copyAllLogs = async () => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return;

    // Get the same filtered logs that are currently displayed
    const currentLogs = activeTab?.searchScope === 'all' 
      ? activeTab.files.flatMap(file => file.logs.map(log => ({ ...log, fileName: file.name })))
      : (activeTab?.files.find((file) => file.id === activeTab?.selectedFileId)?.logs || []);

    const filteredLogs = currentLogs.filter((log) => {
      // Handle both single filter and multiple filter combinations
      const filter = activeTab?.filter;
      let levelMatch = false;
      
      if (filter === 'all') {
        levelMatch = true;
      } else if (Array.isArray(filter)) {
        // Multiple filters selected - log matches if it's any of the selected levels
        levelMatch = filter.length === 0 || filter.includes(log.level);
      } else {
        // Single filter selected
        levelMatch = log.level === filter;
      }
      
      // Handle multi-term OR search
      const searchTerms = activeTab?.searchTerms || [];
      const searchMatch = searchTerms.length === 0 || searchTerms.some(term =>
        log.message.toLowerCase().includes(term.toLowerCase()) ||
        log.context.toLowerCase().includes(term.toLowerCase())
      );
      
      // Handle date range filtering
      const dateRange = activeTab?.dateRange;
      let dateMatch = true;
      if (dateRange && (dateRange.start || dateRange.end)) {
        const logDate = new Date(log.timestamp);
        const logDateString = logDate.toISOString().split('T')[0];
        
        if (dateRange.start && logDateString < dateRange.start) {
          dateMatch = false;
        }
        if (dateRange.end && logDateString > dateRange.end) {
          dateMatch = false;
        }
      }
      
      return levelMatch && searchMatch && dateMatch;
    }).sort((a, b) => {
      const sortMultiplier = activeTab?.sortDirection === 'asc' ? 1 : -1;
      return (a.timestamp - b.timestamp) * sortMultiplier;
    });

    // Format logs as text
    const logsText = filteredLogs.map(log => {
      const fileName = activeTab.searchScope === 'all' && (log as any).fileName ? ` [${(log as any).fileName}]` : '';
      return `[${new Date(log.timestamp).toLocaleString()}] [${log.level.toUpperCase()}] [PID: ${log.pid}] [${log.context}]${fileName}\n${log.message}`;
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(logsText);
      setCopyAllCopied(true);
      setTimeout(() => setCopyAllCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy logs: ', err);
    }
  };

  // Apply AI-Enhanced Search terms from conversation data
  const handleApplyAISearch = () => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab || !activeTab.response || activeTab.aiSearchState !== 'ready') return;

    if (activeTab.isAISearchActive) {
      // Remove AI search terms - keep only user-added terms
      const userTerms = activeTab.searchTerms.filter(term => 
        !activeTab.aiSearchTerms?.includes(term)
      );
      
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? { 
                ...tab, 
                searchTerms: userTerms, 
                searchTerm: '', 
                aiSearchTerms: [],
                isAISearchActive: false 
              }
            : tab
        )
      );
    } else {
      // Add AI search terms
      let aiTerms: string[] = [];
      
      if (typeof activeTab.response === 'string') {
        // Split comma-separated terms and clean them up
        aiTerms = activeTab.response
          .split(',')
          .map(term => term.trim())
          .filter(term => term.length > 0);
      } else if (Array.isArray(activeTab.response)) {
        // Handle array responses
        aiTerms = activeTab.response
          .map(term => String(term).trim())
          .filter(term => term.length > 0);
      }

      // Combine existing user terms with AI terms (avoid duplicates)
      const existingTerms = activeTab.searchTerms || [];
      const userTerms = existingTerms.filter(term => 
        !activeTab.aiSearchTerms?.includes(term)
      );
      const newTerms = [...userTerms];
      
      aiTerms.forEach(term => {
        if (!newTerms.includes(term)) {
          newTerms.push(term);
        }
      });

      // Apply the search terms to the current tab
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? { 
                ...tab, 
                searchTerms: newTerms, 
                searchTerm: '', 
                aiSearchTerms: aiTerms,
                isAISearchActive: true 
              }
            : tab
        )
      );
    }
  };

  // Clear all search terms (both user and AI)
  const handleClearAllSearchTerms = () => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { 
              ...tab, 
              searchTerms: [], 
              searchTerm: '',
              aiSearchTerms: [],
              isAISearchActive: false
            }
          : tab
      )
    );
  };

  return (
    <>
      <div className="max-w-6xl mx-auto">
        <div className="max-w-6xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Log Analyzer</span>
                <button
                  onClick={addTab}
                  className="ml-auto px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <ThemeToggle />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Tab Navigation */}
              <div className="flex overflow-x-auto gap-2 border-b border-gray-300 dark:border-gray-700 min-h-[48px]">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t cursor-pointer min-h-[40px] ${
                      activeTabId === tab.id
                        ? 'bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-300 dark:border-gray-700'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <div className="flex items-center gap-1">
                      {editingTabId === tab.id ? (
                        <input
                          type="text"
                          value={tempTabName}
                          onChange={(e) => {
                            const numericValue = e.target.value.replace(/[^0-9]/g, ''); // Remove non-numeric characters
                            setTempTabName(numericValue);
                          }}
                          onBlur={saveRenamedTab}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRenamedTab();
                          }}
                          placeholder="Enter ticket number"
                          className="bg-transparent border-none outline-none text-inherit italic min-w-0 placeholder-gray-400 dark:placeholder-gray-500"
                          style={{ 
                            fontSize: 'inherit', 
                            lineHeight: 'inherit', 
                            padding: 0,
                            margin: 0,
                            height: 'auto',
                            width: Math.max(140, tempTabName.length * 8 + 40) + 'px'
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className="truncate">{tab.name}</span>
                      )}
                      {editingTabId !== tab.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startRenamingTab(tab.id); // Updated to match the new function signature
                          }}
                          className="text-gray-400 hover:text-gray-600"
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
                              d="M15.232 5.232l3.536 3.536M9 11l3.536-3.536m0 0L15.232 5.232m-3.536 3.536L5.232 15.232m0 0L3 21l5.768-2.232m0 0L15.232 9.768"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTab(tab.id);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab ? (
                <div>
                  {/* File Upload */}
                  <div className="mb-4 flex justify-between items-center">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      multiple
                      className="block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-gray-700 file:text-blue-700 dark:file:text-gray-300 hover:file:bg-blue-100 dark:hover:file:bg-gray-600 mt-4"
                    />
                  </div>

                  {/* File Selector */}
                  {activeTab.files.length > 0 && (
                    <FileSelector
                      files={activeTab.files}
                      selectedFileId={activeTab.selectedFileId}
                      onFileSelect={(id) =>
                        setTabs((prev) =>
                          prev.map((tab) =>
                            tab.id === activeTabId ? { ...tab, selectedFileId: id } : tab
                          )
                        )
                      }
                      removeFile={(fileId) =>
                        setTabs((prev) =>
                          prev.map((tab) =>
                            tab.id === activeTabId
                              ? {
                                  ...tab,
                                  files: tab.files.filter((file) => file.id !== fileId),
                                  selectedFileId:
                                    tab.selectedFileId === fileId ? null : tab.selectedFileId,
                                }
                              : tab
                          )
                        )
                      }
                    />
                  )}

                  {/* Filters */}
                  <LogFilters
                    filter={activeTab.filter}
                    setFilter={(filter) =>
                      setTabs((prev) =>
                        prev.map((tab) =>
                          tab.id === activeTabId ? { ...tab, filter } : tab
                        )
                      )
                    }
                    searchTerm={activeTab.searchTerm}
                    setSearchTerm={(searchTerm) =>
                      setTabs((prev) =>
                        prev.map((tab) =>
                          tab.id === activeTabId ? { ...tab, searchTerm } : tab
                        )
                      )
                    }
                    searchTerms={activeTab.searchTerms}
                    setSearchTerms={(searchTerms) =>
                      setTabs((prev) =>
                        prev.map((tab) =>
                          tab.id === activeTabId ? { ...tab, searchTerms } : tab
                        )
                      )
                    }
                    searchScope={activeTab.searchScope}
                    setSearchScope={(searchScope: 'current' | 'all') =>
                      setTabs((prev) =>
                        prev.map((tab) =>
                          tab.id === activeTabId ? { ...tab, searchScope } : tab
                        )
                      )
                    }
                    sortDirection={activeTab.sortDirection}
                    setSortDirection={(sortDirection) =>
                      setTabs((prev) =>
                        prev.map((tab) =>
                          tab.id === activeTabId ? { ...tab, sortDirection } : tab
                        )
                      )
                    }
                    dateRange={activeTab.dateRange}
                    setDateRange={(dateRange) =>
                      setTabs((prev) =>
                        prev.map((tab) =>
                          tab.id === activeTabId ? { ...tab, dateRange } : tab
                        )
                      )
                    }
                    conversationData={activeTab.response}
                    onApplyAISearch={activeTab.aiSearchState === 'ready' ? handleApplyAISearch : undefined}
                    aiSearchTerms={activeTab.aiSearchTerms || []}
                    isAISearchActive={activeTab.isAISearchActive || false}
                    aiSearchState={activeTab.aiSearchState || 'disabled'}
                    onClearAllSearchTerms={handleClearAllSearchTerms}
                  />

                  {/* Statistics */}
                  <LogStats stats={stats} />

                  {/* Log count and copy button */}
                  <div className="flex items-center justify-between mt-4 mb-2 min-h-[36px]">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Showing {Math.min((currentPage - 1) * logsPerPage + 1, filteredAndSortedLogs.length)} - {Math.min(currentPage * logsPerPage, filteredAndSortedLogs.length)} of {filteredAndSortedLogs.length} logs
                      </span>
                      {/* Copy All Button - Only show when there are search terms */}
                      {activeTab.searchTerms.length > 0 && (
                        <button
                          onClick={copyAllLogs}
                          className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                          title="Copy all filtered logs"
                        >
                          {copyAllCopied ? (
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          Copy all filtered logs
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Log View or Pattern View */}
                  {activeTab.viewMode === 'logs' ? (
                    <div className="space-y-2">
                      {paginatedLogs.map((log, index) => (
                        <LogEntry 
                          key={index} 
                          log={log} 
                          conversation={
                            typeof activeTab.response === 'string' 
                              ? activeTab.response 
                              : Array.isArray(activeTab.response) 
                                ? activeTab.response.join('\n') 
                                : ''
                          }
                          showFileName={activeTab.searchScope === 'all'}
                        />
                      ))}
                    </div>
                  ) : (
                    <PatternView patterns={findPatterns(filteredAndSortedLogs)} />
                  )}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4 flex-wrap">
                      {/* First Page */}
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ««
                      </button>
                      
                      {/* Previous Page */}
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ‹
                      </button>

                      {/* Page Numbers */}
                      {(() => {
                        const { start, end } = getPaginationRange(currentPage, totalPages);
                        const pages = [];
                        
                        // Show ellipsis if we're not starting from page 1
                        if (start > 1) {
                          pages.push(
                            <span key="start-ellipsis" className="px-2 text-gray-500 dark:text-gray-400">...</span>
                          );
                        }
                        
                        // Show page numbers in range
                        for (let i = start; i <= end; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => handlePageChange(i)}
                              className={`px-3 py-1 rounded ${
                                currentPage === i
                                  ? 'bg-blue-500 text-white dark:bg-blue-600'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                              }`}
                            >
                              {i}
                            </button>
                          );
                        }
                        
                        // Show ellipsis if we're not ending at the last page
                        if (end < totalPages) {
                          pages.push(
                            <span key="end-ellipsis" className="px-2 text-gray-500 dark:text-gray-400">...</span>
                          );
                        }
                        
                        return pages;
                      })()}

                      {/* Next Page */}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ›
                      </button>
                      
                      {/* Last Page */}
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        »»
                      </button>

                      {/* Page Jump Input */}
                      <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1 ml-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Go to:</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageInput}
                          onChange={(e) => setPageInput(e.target.value)}
                          className="w-16 px-2 py-1 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                          placeholder={currentPage.toString()}
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                        >
                          Go
                        </button>
                      </form>
                      
                      {/* Page Info */}
                      <span className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500">No tabs open. Add a new tab to get started.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default LogAnalyzer;
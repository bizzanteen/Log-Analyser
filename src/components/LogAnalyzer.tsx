'use client'

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LogEntry as LogEntryType, LogFile, parseLogLine, calculateLogStats, parseHarContent, extractWorkspaceIds, type ExtractedIds } from '../utils/logParser';
import { LogEntry } from './logs/LogEntry';
import { LogFilters } from './logs/LogFilters';
import { LogStats, type HarBucketCounts } from './logs/LogStats';
import { FileSelector } from './logs/FileSelector';
import { PatternView } from './logs/PatternView';
import { HarTimelineView } from './logs/HarTimelineView';
import { findPatterns } from '../utils/patternMatcher';
import { Plus, X, Copy, Check, Filter } from 'lucide-react';
import JSZip from 'jszip';
import { ThemeToggle } from "./theme-toggle";
import { Modal } from '@/components/ui/modal';
import axios from 'axios';

interface Tab {
  id: string;
  name: string;
  files: LogFile[];
  selectedFileId: string | null;
  filter: string | string[];
  harFilter: string | string[]; // Persisted separately so switching Desktop/HAR keeps each view's choice
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
  const [logSourceType, setLogSourceType] = useState<'desktop' | 'har'>('desktop');
  const [tabs, setTabs] = useState<Tab[]>([{
    id: crypto.randomUUID(),
    name: 'Ticket 1',
    files: [],
    selectedFileId: null,
    filter: 'error',
    harFilter: 'all',
    searchTerm: '',
    searchTerms: [], // Initialize as empty array
    searchScope: 'all', // Default search scope
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
  const [selectedHarIndex, setSelectedHarIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExtractIdsModal, setShowExtractIdsModal] = useState(false);
  const [extractedIds, setExtractedIds] = useState<ExtractedIds | null>(null);
  const [extractedIdsErrorsOnly, setExtractedIdsErrorsOnly] = useState<ExtractedIds | null>(null);
  const [extractIdsErrorsOnlyFilter, setExtractIdsErrorsOnlyFilter] = useState(false);
  const [extractIdsCopyWorkspace, setExtractIdsCopyWorkspace] = useState(false);

  // Add a new tab
  const addTab = () => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      name: `Ticket ${tabs.length + 1}`,
      files: [],
      selectedFileId: null,
      filter: 'error',
      harFilter: 'all',
      searchTerm: '',
      searchTerms: [], // Initialize as empty array
      searchScope: 'all', // Default search scope
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
                'Basic ***REDACTED***',
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
    const inputEl = event.target;

    try {
      const newFiles: LogFile[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        const isZip = fileExtension === 'zip';

        if (logSourceType === 'har' && isZip) {
          // HAR view: .zip archive containing .har files
          const zip = new JSZip();
          const zipContents = await zip.loadAsync(file);
          for (const filename in zipContents.files) {
            const entry = zipContents.files[filename];
            if (entry.dir || !filename.toLowerCase().endsWith('.har')) continue;
            const fileData = await entry.async('string');
            const parsedLogs = parseHarContent(fileData);
            newFiles.push({
              id: crypto.randomUUID(),
              name: filename,
              logs: parsedLogs,
              source: 'har',
              uploadedAs: file.name,
            });
          }
        } else if (logSourceType === 'desktop' && isZip) {
          // Desktop view: .zip archive of log files
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
              source: 'desktop',
              uploadedAs: file.name,
            });
          }
        } else {
          // Single file (or non-zip archive)
          const text = await file.text();

          let parsedLogs: LogEntryType[] = [];

          if (logSourceType === 'har' || fileExtension === 'har') {
            parsedLogs = parseHarContent(text);
          } else {
            const lines = text.split('\n');
            parsedLogs = lines
              .map((line, index) => {
                const log = parseLogLine(line);
                if (!log) {
                  console.warn(`Failed to parse line ${index} in ${file.name}:`, line);
                }
                return log;
              })
              .filter((log): log is LogEntryType => log !== null);
          }

          newFiles.push({
            id: crypto.randomUUID(),
            name: file.name,
            logs: parsedLogs,
            source: logSourceType === 'har' || fileExtension === 'har' ? 'har' : 'desktop',
            uploadedAs: file.name,
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
      // Clear the native input so only our custom label shows file status (avoids "No file chosen" + count)
      inputEl.value = '';
    } catch (error) {
      console.error('Error processing files:', error);
      inputEl.value = '';
    }
  };

  // Get the active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  // Use view-specific filter so Desktop and HAR choices persist when switching
  const activeFilter = logSourceType === 'har'
    ? (activeTab?.harFilter ?? 'all')
    : (activeTab?.filter ?? 'error');

  const getFilesForCurrentSource = (tab?: Tab) => {
    if (!tab) return [];
    return tab.files.filter(file =>
      logSourceType === 'har'
        ? file.source === 'har'
        : (file.source ?? 'desktop') === 'desktop'
    );
  };

  const activeSourceFiles = getFilesForCurrentSource(activeTab);
  const effectiveSelectedFileId =
    activeSourceFiles.find(f => f.id === activeTab?.selectedFileId)?.id ??
    activeSourceFiles[0]?.id ??
    null;

  // Get logs based on search scope (current file or all files)
  const currentLogs = activeTab?.searchScope === 'all' 
    ? activeSourceFiles.flatMap(file => file.logs.map(log => ({ ...log, fileName: file.name })))
    : (activeSourceFiles.find((file) => file.id === effectiveSelectedFileId)?.logs || []);

  const handleExtractWorkspaceIds = () => {
    if (!activeTab) return;
    const logsToScan = activeTab.searchScope === 'all'
      ? activeSourceFiles.flatMap(file => file.logs)
      : (activeSourceFiles.find((file) => file.id === effectiveSelectedFileId)?.logs || []);
    setExtractedIds(extractWorkspaceIds(logsToScan));
    setExtractedIdsErrorsOnly(extractWorkspaceIds(logsToScan, { errorsOnly: true }));
    setExtractIdsErrorsOnlyFilter(false);
    setShowExtractIdsModal(true);
  };

  const handleFilterByWorkspaceId = (id: string) => {
    if (!activeTabId) return;
    const isCurrentlyFiltered = activeTab?.searchTerms?.includes(id);
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const terms = tab.searchTerms || [];
        const newTerms = isCurrentlyFiltered
          ? terms.filter((t) => t !== id)
          : [...terms, id];
        return { ...tab, searchTerms: newTerms };
      })
    );
  };

  // Filter and sort the logs based on the active tab's state
  const filteredAndSortedLogs = currentLogs
    .filter((log) => {
      // Handle both single filter and multiple filter combinations (use view-specific filter)
      const filter = activeFilter;
      let levelMatch = true;

      if (filter === 'all') {
        levelMatch = true;
      } else if (logSourceType === 'har') {
        const meta = (log as any).meta;
        const statusCode = typeof meta?.statusCode === 'number' ? meta.statusCode : Number((log as any).pid);
        let bucket: string = 'other';
        if (!Number.isNaN(statusCode)) {
          if (statusCode >= 500) bucket = '5xx';
          else if (statusCode >= 400) bucket = '4xx';
          else if (statusCode >= 300) bucket = '3xx';
          else if (statusCode >= 200) bucket = '2xx';
          else if (statusCode >= 100) bucket = '1xx';
        }
        levelMatch = Array.isArray(filter) ? (filter.length === 0 || filter.includes(bucket)) : filter === bucket;
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

  // HAR view: bucket counts by status (1xx, 2xx, …) for the stats summary
  const harBuckets: HarBucketCounts | undefined = React.useMemo(() => {
    if (logSourceType !== 'har') return undefined;
    const buckets: HarBucketCounts = { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
    for (const log of filteredAndSortedLogs) {
      const meta = (log as any).meta;
      const statusCode = typeof meta?.statusCode === 'number' ? meta.statusCode : Number((log as any).pid);
      if (Number.isNaN(statusCode) || statusCode < 100 || statusCode >= 600) buckets.other++;
      else if (statusCode >= 500) buckets['5xx']++;
      else if (statusCode >= 400) buckets['4xx']++;
      else if (statusCode >= 300) buckets['3xx']++;
      else if (statusCode >= 200) buckets['2xx']++;
      else if (statusCode >= 100) buckets['1xx']++;
      else buckets.other++;
    }
    return buckets;
  }, [logSourceType, filteredAndSortedLogs]);

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
    const sourceFiles = getFilesForCurrentSource(activeTab);
    const currentLogs = activeTab?.searchScope === 'all' 
      ? sourceFiles.flatMap(file => file.logs.map(log => ({ ...log, fileName: file.name })))
      : (sourceFiles.find((file) => file.id === effectiveSelectedFileId)?.logs || []);

    const filteredLogs = currentLogs.filter((log) => {
      // Handle both single filter and multiple filter combinations
      const filter = activeTab?.filter;
      let levelMatch = true;

      if (filter === 'all') {
        levelMatch = true;
      } else if (logSourceType === 'har') {
        const meta = (log as any).meta;
        const statusCode = typeof meta?.statusCode === 'number' ? meta.statusCode : Number((log as any).pid);
        let bucket: string = 'other';
        if (!Number.isNaN(statusCode)) {
          if (statusCode >= 500) bucket = '5xx';
          else if (statusCode >= 400) bucket = '4xx';
          else if (statusCode >= 300) bucket = '3xx';
          else if (statusCode >= 200) bucket = '2xx';
          else if (statusCode >= 100) bucket = '1xx';
        }
        levelMatch = Array.isArray(filter) ? (filter.length === 0 || filter.includes(bucket)) : filter === bucket;
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

  // Clear all log files for the active tab (current view only: desktop or HAR)
  const clearAllFiles = () => {
    if (!activeTabId) return;
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const keepFiles = tab.files.filter((file) =>
          logSourceType === 'har'
            ? (file.source ?? 'desktop') !== 'har'
            : file.source === 'har'
        );
        const keepIds = new Set(keepFiles.map((f) => f.id));
        const newSelectedId =
          tab.selectedFileId && keepIds.has(tab.selectedFileId)
            ? tab.selectedFileId
            : keepFiles[0]?.id ?? null;
        return {
          ...tab,
          files: keepFiles,
          selectedFileId: newSelectedId,
        };
      })
    );
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
              <CardTitle className="flex items-center gap-4 flex-wrap">
                <span>Log Analyser</span>
                <div className="flex rounded border bg-white dark:bg-gray-900">
                  <button
                    onClick={() => setLogSourceType('desktop')}
                    className={`px-4 py-2 rounded-l flex items-center gap-2 text-sm ${
                      logSourceType === 'desktop'
                        ? 'bg-blue-500 text-white dark:bg-blue-600'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Desktop Logs
                  </button>
                  <button
                    onClick={() => setLogSourceType('har')}
                    className={`px-4 py-2 rounded-r flex items-center gap-2 text-sm ${
                      logSourceType === 'har'
                        ? 'bg-blue-500 text-white dark:bg-blue-600'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    HAR Logs
                  </button>
                </div>
                <div className="ml-auto" />
                <ThemeToggle />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeTab ? (
                <div>
                  {/* File Upload - custom button + single status label (no native "No file chosen") */}
                  <div className="mb-4 flex justify-between items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {logSourceType === 'har' ? (
                        <input
                          key="har"
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileUpload}
                          multiple
                          accept=".har,.zip"
                          className="sr-only"
                          aria-label="Choose HAR or archive files"
                        />
                      ) : (
                        <input
                          key="desktop"
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileUpload}
                          multiple
                          accept=".log,.zip,.rar,.tar,.gz,.7z,.tar.gz"
                          className="sr-only"
                          aria-label="Choose log files"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 px-4 py-2 rounded-full border-0 text-sm font-semibold bg-blue-50 dark:bg-gray-700 text-blue-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-600"
                      >
                        Choose files
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400 mt-4 truncate">
                        {activeSourceFiles.length === 0
                          ? 'No file chosen'
                          : (() => {
                              const first = activeSourceFiles[0];
                              const uploadedAs = first?.uploadedAs ?? first?.name;
                              const allSameUpload =
                                activeSourceFiles.length > 1 &&
                                activeSourceFiles.every((f) => (f.uploadedAs ?? f.name) === uploadedAs);
                              // Show archive name when one upload (or single file), else "N files chosen"
                              if (activeSourceFiles.length === 1) return first?.uploadedAs ?? first?.name ?? uploadedAs;
                              if (allSameUpload) return uploadedAs;
                              return `${activeSourceFiles.length} files chosen`;
                            })()}
                      </span>
                    </div>
                    {activeSourceFiles.length > 0 && (
                      <button
                        onClick={clearAllFiles}
                        className="mt-4 px-3 py-2 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 text-sm whitespace-nowrap"
                      >
                        Clear all files
                      </button>
                    )}
                  </div>

                  {/* File Selector */}
                  {activeSourceFiles.length > 0 && (
                    <FileSelector
                      files={activeSourceFiles}
                      selectedFileId={effectiveSelectedFileId}
                      searchScope={activeTab.searchScope}
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
                    filter={activeFilter}
                    setFilter={(filter) =>
                      setTabs((prev) =>
                        prev.map((tab) =>
                          tab.id === activeTabId
                            ? { ...tab, ...(logSourceType === 'har' ? { harFilter: filter } : { filter }) }
                            : tab
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
                    onExtractWorkspaceIds={logSourceType === 'desktop' ? handleExtractWorkspaceIds : undefined}
                    showScopeToggle={logSourceType === 'desktop'}
                    showDateFilter={logSourceType === 'desktop'}
                    isHarView={logSourceType === 'har'}
                  />

                  {/* Statistics and log count on one line */}
                  <div className="flex items-center justify-between mt-4 mb-2 min-h-[36px] flex-wrap gap-x-4 gap-y-1">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-sm text-gray-600 dark:text-gray-400 inline-flex items-center gap-4">
                        <LogStats stats={stats} harBuckets={harBuckets} />
                        <span>
                          Showing {Math.min((currentPage - 1) * logsPerPage + 1, filteredAndSortedLogs.length)} – {Math.min(currentPage * logsPerPage, filteredAndSortedLogs.length)} of {filteredAndSortedLogs.length} logs
                          {stats.filtered < stats.total && ` (of ${stats.total} total)`}
                        </span>
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
                    logSourceType === 'har' ? (
                      <>
                        <HarTimelineView
                          logs={filteredAndSortedLogs as any}
                          selectedIndex={selectedHarIndex}
                          onSelect={(indexOrNull) => setSelectedHarIndex(indexOrNull === null ? null : (prev) => (prev === indexOrNull ? null : indexOrNull))}
                          unfilteredEntryCount={logSourceType === 'har' ? currentLogs.length : undefined}
                        />
                        <div className="space-y-2 mt-4">
                          {selectedHarIndex !== null && selectedHarIndex >= 0 && selectedHarIndex < filteredAndSortedLogs.length ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  Showing 1 request (selected from timeline)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedHarIndex(null)}
                                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  Show all
                                </button>
                              </div>
                              <div className="ring-2 ring-blue-500 rounded-lg">
                                <LogEntry
                                  log={filteredAndSortedLogs[selectedHarIndex]}
                                  conversation={
                                    typeof activeTab.response === 'string'
                                      ? activeTab.response
                                      : Array.isArray(activeTab.response)
                                        ? activeTab.response.join('\n')
                                        : ''
                                  }
                                  showFileName={activeTab.searchScope === 'all'}
                                />
                              </div>
                            </>
                          ) : (
                            paginatedLogs.map((log, index) => {
                              const globalIndex = (currentPage - 1) * logsPerPage + index;
                              return (
                                <div key={index}>
                                  <LogEntry
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
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    ) : (
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
                    )
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

      {/* Extract workspace IDs modal (Desktop Logs only) */}
      {showExtractIdsModal && extractedIds && (
        <Modal onClose={() => { setShowExtractIdsModal(false); setExtractIdsCopyWorkspace(false); }}>
          <div className="flex flex-col gap-4 w-fit">
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Workspace IDs</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-0.5">Click on any ID to open in Support Dashboard</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-0.5">Click filter icon to return logs for this workspace</p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extractIdsErrorsOnlyFilter}
                    onChange={(e) => setExtractIdsErrorsOnlyFilter(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Errors only</span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => setShowExtractIdsModal(false)}
                className="p-1.5 rounded text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {(() => {
              const displayedIds = extractIdsErrorsOnlyFilter && extractedIdsErrorsOnly
                ? extractedIdsErrorsOnly
                : extractedIds;
              const countLabel = extractIdsErrorsOnlyFilter
                ? `Workspace IDs (${displayedIds.workspaceIds.length} of ${extractedIds.workspaceIds.length})`
                : `Workspace IDs (${displayedIds.workspaceIds.length})`;
              return (
            <div className="flex flex-col gap-2 w-fit min-w-[22rem]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{countLabel}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const text = displayedIds.workspaceIds.join('\n');
                    await navigator.clipboard.writeText(text);
                    setExtractIdsCopyWorkspace(true);
                    setTimeout(() => setExtractIdsCopyWorkspace(false), 2000);
                  }}
                  className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 flex items-center gap-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 shrink-0"
                >
                  {extractIdsCopyWorkspace ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  Copy all
                </button>
              </div>
              <div className="p-3 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs overflow-auto max-h-64 font-mono space-y-1 w-fit min-w-[22rem]">
                {displayedIds.workspaceIds.length ? displayedIds.workspaceIds.map((id) => {
                  const isFiltered = activeTab?.searchTerms?.includes(id);
                  return (
                  <div key={id} className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleFilterByWorkspaceId(id)}
                      className={`shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                        isFiltered
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                      title={isFiltered ? 'Remove from search' : 'Filter logs by this workspace ID'}
                      aria-label={isFiltered ? 'Remove from search' : 'Filter by this ID'}
                    >
                      <Filter className={`w-4 h-4 ${isFiltered ? 'fill-current' : ''}`} strokeWidth={isFiltered ? 2.5 : 2} />
                    </button>
                    <a
                      href={`https://support.postmanlabs.com/workspaces/${id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-blue-600 dark:text-blue-400 hover:underline break-all min-w-0 ${isFiltered ? 'font-bold' : ''}`}
                      title="Open in Support Dashboard"
                    >
                      {id}
                    </a>
                  </div>
                  );
                }) : '(none found)'}
              </div>
            </div>
              );
            })()}
          </div>
        </Modal>
      )}
    </>
  );
};

export default LogAnalyzer;
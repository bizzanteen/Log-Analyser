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
import { Plus, X } from 'lucide-react';
import JSZip from 'jszip';
import { ThemeToggle } from "./theme-toggle";

interface Tab {
  id: string;
  name: string;
  files: LogFile[];
  selectedFileId: string | null;
  filter: string;
  searchTerm: string;
  sortDirection: 'asc' | 'desc';
  viewMode: 'logs' | 'patterns';
}

const LogAnalyzer = () => {
  const [tabs, setTabs] = useState<Tab[]>([{
    id: crypto.randomUUID(),
    name: 'Tab 1',
    files: [],
    selectedFileId: null,
    filter: 'all',
    searchTerm: '',
    sortDirection: 'desc',
    viewMode: 'logs',
  }]); // Ensure at least one tab is always initialized

  const [activeTabId, setActiveTabId] = useState<string | null>(tabs.length > 0 ? tabs[0].id : null); // Safeguard against empty tabs array
  const [editingTabId, setEditingTabId] = useState<string | null>(null); // ID of the tab being renamed
  const [tempTabName, setTempTabName] = useState<string>(''); // Temporary name for the tab being edited
  const [currentPage, setCurrentPage] = useState(1); // Track the current page
  const logsPerPage = 800; // Maximum logs per page

  // Add a new tab
  const addTab = () => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      name: `Tab ${tabs.length + 1}`,
      files: [],
      selectedFileId: null,
      filter: 'all',
      searchTerm: '',
      sortDirection: 'desc',
      viewMode: 'logs',
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
  const startRenamingTab = (id: string, currentName: string) => {
    setEditingTabId(id);
    setTempTabName(currentName); // Set the current name as the temporary name
  };

  // Save the renamed tab
  const saveRenamedTab = () => {
    if (editingTabId) {
      setTabs((prev) =>
        prev.map((tab) => (tab.id === editingTabId ? { ...tab, name: tempTabName } : tab))
      );
      setEditingTabId(null); // Exit editing mode
      setTempTabName(''); // Clear the temporary name
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

  // Get the selected file and logs for the active tab
  const selectedFile = activeTab?.files.find((file) => file.id === activeTab?.selectedFileId);
  const currentLogs = selectedFile?.logs || [];

  // Filter and sort the logs based on the active tab's state
  const filteredAndSortedLogs = currentLogs
    .filter((log) => {
      const levelMatch = activeTab?.filter === 'all' || log.level === activeTab?.filter;
      const searchMatch =
        !activeTab?.searchTerm ||
        log.message.toLowerCase().includes(activeTab.searchTerm.toLowerCase()) ||
        log.context.toLowerCase().includes(activeTab.searchTerm.toLowerCase());
      return levelMatch && searchMatch;
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

  return (
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
            <div className="flex overflow-x-auto gap-2 border-b border-gray-300 dark:border-gray-700">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t cursor-pointer ${
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
                        onChange={(e) => setTempTabName(e.target.value)}
                        onBlur={saveRenamedTab}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRenamedTab();
                        }}
                        className="px-2 py-1 rounded border border-gray-300 text-black"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="truncate">{tab.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startRenamingTab(tab.id, tab.name);
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
                      </div>
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
                  sortDirection={activeTab.sortDirection}
                  setSortDirection={(sortDirection) =>
                    setTabs((prev) =>
                      prev.map((tab) =>
                        tab.id === activeTabId ? { ...tab, sortDirection } : tab
                      )
                    )
                  }
                />

                {/* Statistics */}
                <LogStats stats={stats} />

                {/* Log View or Pattern View */}
                {activeTab.viewMode === 'logs' ? (
                  <div className="space-y-2 mt-4">
                    {paginatedLogs.map((log, index) => (
                      <LogEntry key={index} log={log} />
                    ))}
                  </div>
                ) : (
                  <PatternView patterns={findPatterns(filteredAndSortedLogs)} />
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    {Array.from({ length: totalPages }, (_, index) => (
                      <button
                        key={index}
                        onClick={() => handlePageChange(index + 1)}
                        className={`px-3 py-1 mx-1 rounded ${
                          currentPage === index + 1
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
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
  );
};

export default LogAnalyzer;
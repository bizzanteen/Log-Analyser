# Log Analyser

A Next.js web app for analysing Postman desktop app logs and HAR files. Built to help support engineers quickly diagnose customer-reported issues.

## Features

- **Log file analysis** — parse and filter Postman desktop log files by level (info, warn, error), keyword, and timestamp
- **HAR file support** — visualise HTTP request timelines colour-coded by status code (1xx–5xx) to trace the full flow of a customer session
- **Pattern analysis** — automatically group recurring log patterns to surface common issues at a glance
- **Multi-tab interface** — open and compare multiple log sessions side by side
- **Stats dashboard** — at-a-glance counts of log levels or HTTP response buckets per file

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click **+** to open a new tab
2. Upload a `.log` file (Postman desktop logs) or a `.har` file
3. Use the filter controls to narrow down entries by level or keyword
4. Switch to **Pattern View** to group recurring log lines
5. For HAR files, the timeline view shows each request as a colour-coded bar by status code and duration

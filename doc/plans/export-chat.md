# Plan: Export Chat

**Status:** Planned
**Priority:** Medium

## Overview

Users can download a full conversation in multiple formats: Markdown, PDF, or JSON.

## Goals

- Export button accessible from chat header menu
- Supported formats: Markdown (`.md`), PDF (`.pdf`), JSON (`.json`)
- Exported file includes all messages, timestamps, and model info
- Artifacts (code blocks, etc.) rendered appropriately in each format

## Technical Considerations

- Server-side export route: `GET /api/chat/[id]/export?format=md|pdf|json`
- Markdown: serialize `Message_v2.parts` to text/code blocks
- PDF: use `pdfjs-dist` or a server-side HTML→PDF renderer
- JSON: return raw message array with metadata
- Set `Content-Disposition: attachment` header for file download

## Tasks

- [ ] Build `GET /api/chat/[id]/export` route with format param
- [ ] Implement Markdown serializer for chat messages
- [ ] Implement JSON export (structured message array)
- [ ] Implement PDF export (server-side render)
- [ ] Add export button to chat header dropdown
- [ ] Handle artifact content in exports (code blocks, tables)
- [ ] Add E2E test for each export format

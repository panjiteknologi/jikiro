# Plan: Conversation Search

**Status:** Planned
**Priority:** Medium

## Overview

Full-text search across all of a user's chat history — find past conversations by keyword, message content, or attached file name.

## Goals

- Search bar accessible from sidebar
- Results show matching chats with highlighted snippet
- Filter by date range or model used
- Fast response (< 300ms for most queries)

## Technical Considerations

- Use PostgreSQL full-text search (`tsvector` / `tsquery`) on `Message_v2.parts`
- Add `search_vector` generated column to `Message_v2` or a separate search index table
- API route: `GET /api/search?q=...&from=...&to=...`
- Debounce search input on client (300ms)
- Results link directly to the matching chat (auto-scroll to message if possible)

## Tasks

- [ ] Add `tsvector` search column to `Message_v2` table + migration
- [ ] Add `searchMessages` query to `lib/db/queries.ts`
- [ ] Build `GET /api/search` route with pagination
- [ ] Build search input UI in sidebar
- [ ] Build search results dropdown/panel with snippets
- [ ] Add date range and model filters to search
- [ ] Link results to chat with message highlight
- [ ] Add E2E test for search returning correct results

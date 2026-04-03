# Plan: Chat Sharing

**Status:** Planned
**Priority:** High

## Overview

Users can generate a public, read-only link to any conversation. Anyone with the link can view the full chat without logging in.

## Goals

- One-click share button per conversation
- Generates a unique slug/token for the shared chat
- Public view renders messages read-only (no reply, no auth required)
- Owner can revoke the share link at any time

## Technical Considerations

- Add `shareToken` (unique, nullable) column to `Chat` table
- Public route: `app/share/[token]/page.tsx` — fetches chat by token, no auth
- `PATCH /api/chat/[id]/share` — generates or revokes the token
- Shared view reuses existing message rendering components (read-only mode)
- SEO-friendly: `<title>` and `<meta>` derived from first user message

## Tasks

- [ ] Add `shareToken` column to `Chat` table + migration
- [ ] Add `generateShareToken` / `revokeShareToken` queries
- [ ] Build `PATCH /api/chat/[id]/share` route
- [ ] Add share button + copy-link UI to chat header
- [ ] Build `app/share/[token]/page.tsx` public read-only view
- [ ] Render messages in read-only mode on public page
- [ ] Add revoke share option in chat settings
- [ ] Add OG meta tags to shared page for link previews
- [ ] Add E2E test for share link generation and public access

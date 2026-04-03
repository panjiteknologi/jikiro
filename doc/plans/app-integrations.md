# Plan: App Integrations

**Status:** In Progress
**Priority:** High
**Entitlement:** `features.integrations` (count-based per plan)

## Overview

Let users connect third-party apps (Notion, GitHub, Google Drive, etc.) so the AI can read from and act on external data sources within a chat.

## Goals

- OAuth-based connection flow per integration
- Connected integrations show up as available tools in chat
- Per-plan limit on number of active integrations
- Users can disconnect integrations at any time

## Technical Considerations

- New `Integration` table: `userId`, `provider`, `accessToken`, `refreshToken`, `expiresAt`, `metadata`
- Tool definitions in `lib/ai/tools/` per integration (e.g. `notion-fetch`, `github-search`)
- OAuth callback routes under `app/(auth)/api/integrations/[provider]/`
- Gate number of active integrations via `features.integrations` entitlement
- Token refresh logic for expiring OAuth tokens

## Tasks

- [ ] Add `Integration` table to `lib/db/schema.ts`
- [ ] Build OAuth connection flow (callback route + token storage)
- [ ] Build integrations settings UI (`app/settings/integrations/`)
- [ ] Implement Notion integration tool (read pages/databases)
- [ ] Implement GitHub integration tool (read repos/issues)
- [ ] Implement Google Drive integration tool (read files)
- [ ] Register integration tools dynamically based on connected integrations
- [ ] Gate active integration count via entitlement
- [ ] Add disconnect / re-authenticate flow
- [ ] Add E2E test for integration connect & tool use

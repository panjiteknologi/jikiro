# Plan: Project Creation

**Status:** In Progress
**Priority:** High
**Entitlement:** `features.projects`

## Overview

Allow users to organize conversations into Projects — a named workspace that groups related chats, documents, and settings under a single context.

## Goals

- Users can create, rename, and delete projects
- Each project has its own chat history and uploaded documents
- Project-level system prompt (optional)
- Sidebar shows active project with quick switching

## Technical Considerations

- Add `Project` table to schema with `userId`, `name`, `systemPrompt`, `createdAt`
- Add `projectId` FK to `Chat` table
- Projects page (`app/projects/`) already exists as a shell — needs full implementation
- Entitlement gate: only plans with `features.projects = true` can create projects
- Sidebar needs project switcher component

## Tasks

- [ ] Add `Project` table to `lib/db/schema.ts`
- [ ] Generate and run migration
- [ ] Add project CRUD queries to `lib/db/queries.ts`
- [ ] Build project list & create UI on `app/projects/`
- [ ] Add project switcher to sidebar
- [ ] Scope chat history to active project
- [ ] Add optional system prompt field per project
- [ ] Gate behind `features.projects` entitlement check
- [ ] Add E2E test for project creation flow

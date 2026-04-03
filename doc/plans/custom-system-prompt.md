# Plan: Custom System Prompt

**Status:** Planned
**Priority:** Medium

## Overview

Let users define a custom system prompt at the chat or project level, overriding or extending the default platform prompt.

## Goals

- Per-chat system prompt editable before and during a conversation
- Per-project default system prompt applied to all new chats in that project
- System prompt visible and editable in chat settings panel
- Prompt length limit enforced per plan

## Technical Considerations

- Add `systemPrompt` nullable column to `Chat` table
- Already exists on `Project` table (from project-creation plan)
- Merge user system prompt with platform prompt in `lib/ai/prompts.ts`
- Enforce character limit based on plan entitlement
- UI: expandable system prompt editor in chat header or side panel

## Tasks

- [ ] Add `systemPrompt` column to `Chat` table + migration
- [ ] Update `lib/ai/prompts.ts` to merge custom + platform prompt
- [ ] Add system prompt editor UI to chat settings panel
- [ ] Persist prompt via `PATCH /api/chat/[id]`
- [ ] Apply project-level default prompt to new chats
- [ ] Enforce character limit per plan
- [ ] Add E2E test for custom prompt affecting AI response

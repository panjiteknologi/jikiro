# Plan: Scheduled Messages / Reminders

**Status:** Planned
**Priority:** Medium

## Overview

Users can schedule a prompt to be sent to the AI at a future time or on a recurring schedule — useful for daily summaries, automated reports, or reminders.

## Goals

- Schedule a one-time or recurring prompt (cron-like)
- AI response delivered to specified chat or new chat
- View and manage all scheduled prompts in Settings
- Result optionally sent via push notification or email

## Technical Considerations

- New table: `ScheduledPrompt` (`userId`, `chatId?`, `prompt`, `modelId`, `cronExpr`, `nextRunAt`, `enabled`)
- Execution via Vercel Cron or Workflows triggered on `nextRunAt`
- On trigger: create or append to target chat, run completion, store result
- Notification on completion (push or email)
- UI: schedule builder in chat or settings (`app/settings/schedules/`)

## Tasks

- [ ] Add `ScheduledPrompt` table to schema + migration
- [ ] Build schedule CRUD API routes
- [ ] Build schedule builder UI (date/time picker + cron option)
- [ ] Implement Vercel Cron / Workflow trigger for `nextRunAt`
- [ ] Execute prompt and store AI response to target chat
- [ ] Send completion notification (push / email)
- [ ] Build scheduled prompts management page in settings
- [ ] Add E2E test for create → execute → result flow

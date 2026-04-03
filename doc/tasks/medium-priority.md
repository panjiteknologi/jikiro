# Tasks: Medium Priority

## Conversation Search
> Plan: [doc/plans/conversation-search.md](../plans/conversation-search.md)

- [ ] Add `tsvector` search column to `Message_v2` table + migration
- [ ] Add `searchMessages` query to `lib/db/queries.ts`
- [ ] Build `GET /api/search` route with pagination
- [ ] Build search input UI in sidebar
- [ ] Build search results dropdown/panel with snippets
- [ ] Add date range and model filters to search
- [ ] Link results to chat with message highlight
- [ ] Add E2E test for search returning correct results

---

## Custom System Prompt
> Plan: [doc/plans/custom-system-prompt.md](../plans/custom-system-prompt.md)

- [ ] Add `systemPrompt` column to `Chat` table + migration
- [ ] Update `lib/ai/prompts.ts` to merge custom + platform prompt
- [ ] Add system prompt editor UI to chat settings panel
- [ ] Persist prompt via `PATCH /api/chat/[id]`
- [ ] Apply project-level default prompt to new chats
- [ ] Enforce character limit per plan
- [ ] Add E2E test for custom prompt affecting AI response

---

## Scheduled Messages / Reminders
> Plan: [doc/plans/scheduled-messages.md](../plans/scheduled-messages.md)

- [ ] Add `ScheduledPrompt` table to schema + migration
- [ ] Build schedule CRUD API routes
- [ ] Build schedule builder UI (date/time picker + cron option)
- [ ] Implement Vercel Cron / Workflow trigger for `nextRunAt`
- [ ] Execute prompt and store AI response to target chat
- [ ] Send completion notification (push / email)
- [ ] Build scheduled prompts management page in settings
- [ ] Add E2E test for create → execute → result flow

---

## Export Chat
> Plan: [doc/plans/export-chat.md](../plans/export-chat.md)

- [ ] Build `GET /api/chat/[id]/export` route with format param
- [ ] Implement Markdown serializer for chat messages
- [ ] Implement JSON export (structured message array)
- [ ] Implement PDF export (server-side render)
- [ ] Add export button to chat header dropdown
- [ ] Handle artifact content in exports (code blocks, tables)
- [ ] Add E2E test for each export format

---

## Model Comparison
> Plan: [doc/plans/model-comparison.md](../plans/model-comparison.md)

- [ ] Build `POST /api/chat/compare` route (fan-out to N models)
- [ ] Build comparison layout UI (side-by-side columns)
- [ ] Add multi-model selector to trigger comparison mode
- [ ] Stream each model response independently into its column
- [ ] Show model name, latency, and token count per column
- [ ] Deduct credits per model on completion
- [ ] Add E2E test for 2-model comparison flow

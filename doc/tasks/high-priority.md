# Tasks: High Priority

## Video Generation
> Plan: [doc/plans/video-generation.md](../plans/video-generation.md)

- [ ] Add video provider abstraction to `lib/ai/providers.ts`
- [ ] Create `artifacts/video/` template and client component
- [ ] Build video generation workflow in `workflows/`
- [ ] Add video artifact rendering component (HTML5 `<video>` with controls)
- [ ] Stream generation progress to chat UI
- [ ] Upload final video to S3 and attach to message
- [ ] Gate behind `features.videoGeneration` entitlement
- [ ] Handle generation errors and quota exceeded
- [ ] Add E2E test for video generation flow

---

## Bring Your Own API Key (BYOK)
> Plan: [doc/plans/bring-your-own-api-key.md](../plans/bring-your-own-api-key.md)

- [ ] Add `ApiKey` table to `lib/db/schema.ts`
- [ ] Implement key encryption/decryption utility in `lib/`
- [ ] Add API key management UI to `app/settings/`
- [ ] Add CRUD API routes for user API keys
- [ ] Thread user key through provider initialization at request time
- [ ] Skip credit deduction for BYOK-keyed requests
- [ ] Show masked key (last 4 chars) in settings UI
- [ ] Add delete / rotate key flow
- [ ] Add E2E test for BYOK key add & usage

---

## Chat Sharing
> Plan: [doc/plans/chat-sharing.md](../plans/chat-sharing.md)

- [ ] Add `shareToken` column to `Chat` table + migration
- [ ] Add `generateShareToken` / `revokeShareToken` queries
- [ ] Build `PATCH /api/chat/[id]/share` route
- [ ] Add share button + copy-link UI to chat header
- [ ] Build `app/share/[token]/page.tsx` public read-only view
- [ ] Render messages in read-only mode on public page
- [ ] Add revoke share option in chat settings
- [ ] Add OG meta tags to shared page for link previews
- [ ] Add E2E test for share link generation and public access

---

## Team / Workspace
> Plan: [doc/plans/team-workspace.md](../plans/team-workspace.md)

- [ ] Add `Workspace` and `WorkspaceMember` tables to schema
- [ ] Generate and run migration
- [ ] Build workspace creation flow (name, slug)
- [ ] Build email invite system (send invite, accept/decline)
- [ ] Add workspace switcher to sidebar
- [ ] Scope chats and credits to workspace
- [ ] Build workspace settings page (members, billing, models)
- [ ] Implement role-based access control on API routes
- [ ] Handle workspace billing (workspace subscription plan)
- [ ] Add E2E tests for invite and member access flows

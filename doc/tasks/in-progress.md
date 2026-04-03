# Tasks: In Progress

## Project Creation
> Plan: [doc/plans/project-creation.md](../plans/project-creation.md)

- [ ] Add `Project` table to `lib/db/schema.ts`
- [ ] Generate and run migration
- [ ] Add project CRUD queries to `lib/db/queries.ts`
- [ ] Build project list & create UI on `app/projects/`
- [ ] Add project switcher to sidebar
- [ ] Scope chat history to active project
- [ ] Add optional system prompt field per project
- [ ] Gate behind `features.projects` entitlement check
- [ ] Add E2E test for project creation flow

---

## App Integrations
> Plan: [doc/plans/app-integrations.md](../plans/app-integrations.md)

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

# Plan: Team / Workspace

**Status:** Planned
**Priority:** High

## Overview

Allow multiple users to collaborate under a shared workspace — pooled credits, shared chat history, and team-level billing.

## Goals

- Workspace owner can invite members via email
- Shared credit pool billed to workspace subscription
- Members can see shared chats (with permission controls)
- Workspace-level model and integration settings

## Technical Considerations

- New tables: `Workspace`, `WorkspaceMember` (role: owner/admin/member)
- Migrate `Subscription` and `CreditLedger` to be workspace-scoped (not just user-scoped)
- Invitation flow: email invite → accept → join workspace
- Permission model: owner > admin > member (read/write/admin scopes)
- UI: workspace switcher in sidebar, workspace settings page

## Tasks

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

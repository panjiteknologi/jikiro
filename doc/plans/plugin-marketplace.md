# Plan: Plugin / Tool Marketplace

**Status:** Planned
**Priority:** Low

## Overview

A community marketplace where users can discover, install, and use custom AI tools built by other developers — extending chat with domain-specific capabilities.

## Goals

- Browse and search published plugins
- One-click install into user's chat environment
- Plugin manifest defines tool schema and endpoint
- Developer portal to submit and manage plugins

## Technical Considerations

- Plugin manifest format: name, description, tool schemas (OpenAPI-compatible), endpoint URL
- New tables: `Plugin` (registry entry), `InstalledPlugin` (`userId`, `pluginId`)
- Tool calls forwarded to plugin's endpoint via server-side proxy (never expose to client)
- Sandbox: validate and rate-limit plugin endpoint calls
- UI: marketplace browse page, installed plugins in settings

## Tasks

- [ ] Define plugin manifest schema (Zod)
- [ ] Add `Plugin` and `InstalledPlugin` tables to schema
- [ ] Build plugin registry API (`/api/plugins`)
- [ ] Build server-side plugin proxy (forward tool calls securely)
- [ ] Build marketplace browse UI
- [ ] Build install/uninstall flow
- [ ] Build installed plugins management in settings
- [ ] Build developer submission portal / docs
- [ ] Add E2E test for plugin install and tool invocation

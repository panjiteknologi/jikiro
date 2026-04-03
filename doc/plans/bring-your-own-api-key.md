# Plan: Bring Your Own API Key (BYOK)

**Status:** Planned
**Priority:** High

## Overview

Let users supply their own LLM provider API keys. Usage against BYOK keys does not consume Jikiro credits, enabling power users to use models beyond their plan's credit allowance.

## Goals

- Users can add API keys per provider (OpenAI, Anthropic, Google, etc.) in Settings
- Keys are stored encrypted at rest
- Chat uses the user's key when available, falls back to platform key otherwise
- No credits deducted for BYOK usage

## Technical Considerations

- New `ApiKey` table: `userId`, `provider`, `encryptedKey`, `createdAt`
- Encrypt keys using a server-side secret before storing (e.g. AES-256)
- Inject user key into provider initialization in `lib/ai/providers.ts`
- Skip `AiGenerationUsage` credit deduction when using a BYOK key
- Never return decrypted key to client; only show last 4 chars

## Tasks

- [ ] Add `ApiKey` table to `lib/db/schema.ts`
- [ ] Implement key encryption/decryption utility in `lib/`
- [ ] Add API key management UI to `app/settings/`
- [ ] Add CRUD API routes for user API keys
- [ ] Thread user key through provider initialization at request time
- [ ] Skip credit deduction for BYOK-keyed requests
- [ ] Show masked key (last 4 chars) in settings UI
- [ ] Add delete / rotate key flow
- [ ] Add E2E test for BYOK key add & usage

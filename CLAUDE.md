# Jikiro

AI-powered chatbot platform built with Next.js, supporting multiple LLM providers, document ingestion, billing, and authentication.

## Tech Stack

- **Framework:** Next.js 16.2.0 (App Router) + React 19 + TypeScript 5.6
- **UI:** shadcn/ui (Radix UI) + Tailwind CSS 4
- **AI:** Vercel AI SDK 6 — multi-provider (OpenAI, Anthropic, Google, Mistral, DeepSeek, xAI)
- **Database:** PostgreSQL + Drizzle ORM (Neon Serverless)
- **Auth:** NextAuth.js v5 (email/password + Google OAuth + guest)
- **Storage:** S3-compatible (for file attachments)
- **Cache:** Redis
- **Billing:** Tripay payment gateway
- **Linter/Formatter:** Biome via Ultracite presets
- **Package Manager:** pnpm 10.32.1

## Commands

```bash
# Development
pnpm dev          # Start dev server with Turbo on localhost:3000

# Build & Deploy
pnpm build        # Run DB migrations then build for production
pnpm start        # Start production server

# Database
pnpm db:generate  # Generate migration files from schema changes
pnpm db:migrate   # Run pending migrations
pnpm db:push      # Push schema directly (no migration file)
pnpm db:studio    # Open Drizzle Studio GUI
pnpm db:pull      # Pull schema from existing DB
pnpm db:check     # Validate migration consistency
pnpm db:up        # Apply pending migrations

# Code Quality
pnpm check        # Lint with Biome (via Ultracite)
pnpm fix          # Auto-fix lint issues

# Testing
pnpm test         # Run Playwright E2E tests (Chrome)
```

## Project Structure

```
app/
  (auth)/         # Login, register, NextAuth config & API routes
  (chat)/         # Main chat UI + all API routes (api/chat, api/files, api/billing, etc.)
  billing/        # Billing/subscription pages
  projects/       # Projects page
  settings/       # User settings & model selection

lib/
  ai/             # AI model definitions, provider init, system prompts, entitlements, tools
  db/             # Drizzle schema, client, queries, migrations, billing queries
  billing/        # Tripay billing logic
  storage/        # S3 file operations
  attachments/    # File attachment handling
  artifacts/      # Artifact generation logic
  editor/         # Editor utilities

components/
  chat/           # Chat UI components
  auth/           # Auth forms
  billing/        # Billing UI
  settings/       # Settings UI
  ui/             # shadcn/ui base components

artifacts/        # Artifact templates (code, text, image, sheet)
workflows/        # Vercel Workflow steps for background document ingestion
tests/e2e/        # Playwright tests (auth, billing, chat, model-selector, api)
```

## Database

Schema is defined in `lib/db/schema.ts` (14 tables). Uses pgvector extension for embeddings.

Key tables: `User`, `Chat`, `Message_v2`, `Subscription`, `CreditLedger`, `AiGenerationUsage`, `AttachmentAsset`, `AttachmentEmbedding`.

Migrations run automatically on `pnpm build`. For local changes, run `pnpm db:generate` then `pnpm db:migrate`.

## AI Integration

Models are defined in `lib/ai/models.ts`. Providers are initialized in `lib/ai/providers.ts` via Vercel AI Gateway.

Default chat model: DeepSeek V3.2. Embedding model: `openai/text-embedding-3-small`.

Feature entitlements (which models/features each plan can access) are in `lib/ai/entitlements.ts`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth encryption key (`openssl rand -base64 32`) |
| `APP_BASE_URL` | App base URL (e.g. `http://localhost:3000`) |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key (not needed on Vercel — uses OIDC) |
| `AI_EMBEDDING_MODEL` | Embedding model ID |
| `POSTGRES_URL` | PostgreSQL connection string |
| `WORKFLOW_TARGET_WORLD` | Workflow provider (`@workflow/world-postgres`) |
| `WORKFLOW_POSTGRES_URL` | PostgreSQL URL for workflows |
| `REDIS_URL` | Redis connection string |
| `S3_*` | S3-compatible storage credentials |
| `TRIPAY_*` | Tripay billing credentials (`sandbox` or `production`) |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth credentials |

## Code Style

- Biome handles both linting and formatting — run `pnpm fix` before committing
- TypeScript strict mode; path alias `@/*` maps to project root
- React Server Components by default; add `"use client"` only when needed
- Zod for all external data validation (API inputs, env vars)
- Server-only logic must import `server-only` to prevent accidental client bundling

## Testing

Playwright E2E tests in `tests/e2e/`. Tests auto-start the dev server. Timeout is 240s.

```bash
pnpm test  # Runs all suites against localhost:3000
```

Test fixtures and helpers are in `tests/fixtures.ts` and `tests/helpers.ts`.

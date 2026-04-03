# Tasks: Completed

## Multi-provider LLM Support
- [x] Integrate Vercel AI SDK with unified provider interface
- [x] Support OpenAI, Anthropic, Google, Mistral, DeepSeek, xAI providers
- [x] Define model capabilities and metadata in `lib/ai/models.ts`
- [x] Initialize providers via Vercel AI Gateway in `lib/ai/providers.ts`

## Streaming Chat Responses
- [x] Implement SSE streaming via `app/(chat)/api/chat/route.ts`
- [x] Add resumable streams for interrupted connections
- [x] Support streaming for all configured providers

## Authentication
- [x] Email/password registration and login
- [x] Google OAuth integration via NextAuth.js v5
- [x] Guest mode with limited model access
- [x] Auth config in `app/(auth)/auth.ts` and `app/(auth)/auth.config.ts`

## Subscription Plans
- [x] Define free, pro, max plan tiers
- [x] Implement entitlement system in `lib/ai/entitlements.ts`
- [x] Gate features and model access per plan

## Billing Integration (Tripay)
- [x] Tripay payment gateway integration
- [x] Monthly and yearly billing intervals
- [x] Checkout flow with `BillingCheckout` table
- [x] Webhook handling for payment events via `BillingEvent` table
- [x] Billing dashboard with plan selection UI

## Credit Ledger
- [x] Track AI usage per generation in `AiGenerationUsage` table
- [x] Credit balance tracking in `CreditLedger` table
- [x] Display remaining credits in billing dashboard

## Model Selector
- [x] Model selection UI in settings
- [x] Per-conversation model choice
- [x] Model list filtered by plan entitlement

## File Attachments
- [x] Upload PDF, DOCX, XLSX, CSV, TXT files per chat
- [x] Store attachments in S3-compatible object storage
- [x] Attach files to messages via `AttachmentAsset` table

## Document Ingestion
- [x] Extract text from PDF, DOCX, XLSX, CSV files
- [x] Chunk documents into segments via Vercel Workflows
- [x] Store chunks in `AttachmentChunk` table

## Vector Search
- [x] Generate embeddings using `openai/text-embedding-3-small`
- [x] Store embeddings in `AttachmentEmbedding` table with pgvector
- [x] Semantic search over uploaded documents in chat context

## S3 File Storage
- [x] S3-compatible upload in `lib/storage/`
- [x] Generate signed URLs for file access
- [x] File upload route at `app/(chat)/api/files/upload/`

## Artifact Generation
- [x] Render code, text, image, and sheet artifacts inline in chat
- [x] Artifact templates in `artifacts/` directory

## Rich Text Editor
- [x] ProseMirror-based editor for text artifacts
- [x] Markdown import/export support

## Code Editor
- [x] CodeMirror 6 editor for code artifacts
- [x] Syntax highlighting for Python and other languages
- [x] One Dark theme

## Projects Page
- [x] Basic project listing UI at `app/projects/`

## Settings Page
- [x] User preferences UI at `app/settings/`
- [x] Model management page at `app/settings/models/`

## Dark / Light Theme
- [x] System-aware theme detection
- [x] Manual theme toggle via `next-themes`

## Chat History
- [x] Persist conversations in `Chat` and `Message_v2` tables
- [x] Chat history sidebar with conversation list

## Message Voting
- [x] Thumbs up/down feedback on AI messages
- [x] Vote stored via `POST /api/vote`

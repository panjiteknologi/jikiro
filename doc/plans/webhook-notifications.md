# Plan: Webhook Notifications

**Status:** Planned
**Priority:** Low

## Overview

Let users register webhook URLs to receive HTTP callbacks on chat events — message complete, workflow done, billing event, etc.

## Goals

- Users register webhooks per event type in Settings
- Signed payloads (HMAC) for security
- Retry logic for failed deliveries
- Delivery log viewable in settings

## Technical Considerations

- New tables: `Webhook` (`userId`, `url`, `secret`, `events[]`), `WebhookDelivery` (log)
- Dispatch webhooks via Vercel Workflows for retry/backoff
- Sign payloads with `HMAC-SHA256` using the webhook secret
- Events: `chat.message.complete`, `workflow.complete`, `billing.payment.success`, etc.
- UI: webhook list + add/delete in `app/settings/webhooks/`

## Tasks

- [ ] Add `Webhook` and `WebhookDelivery` tables to schema
- [ ] Build webhook CRUD UI in settings
- [ ] Build `POST /api/settings/webhooks` route
- [ ] Implement HMAC-SHA256 payload signing utility
- [ ] Build webhook dispatcher workflow with retry/backoff
- [ ] Fire webhooks on relevant events (chat complete, payment, etc.)
- [ ] Build delivery log UI in settings
- [ ] Add E2E test for webhook registration and delivery

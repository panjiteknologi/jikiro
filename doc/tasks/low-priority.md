# Tasks: Low Priority

## Plugin / Tool Marketplace
> Plan: [doc/plans/plugin-marketplace.md](../plans/plugin-marketplace.md)

- [ ] Define plugin manifest schema (Zod)
- [ ] Add `Plugin` and `InstalledPlugin` tables to schema
- [ ] Build plugin registry API (`/api/plugins`)
- [ ] Build server-side plugin proxy (forward tool calls securely)
- [ ] Build marketplace browse UI
- [ ] Build install/uninstall flow
- [ ] Build installed plugins management in settings
- [ ] Build developer submission portal / docs
- [ ] Add E2E test for plugin install and tool invocation

---

## Voice Input & TTS Output
> Plan: [doc/plans/voice-tts.md](../plans/voice-tts.md)

- [ ] Build mic capture UI (push-to-talk button in chat input)
- [ ] Build `POST /api/audio/transcribe` route using Whisper
- [ ] Insert transcribed text into chat input on completion
- [ ] Build `POST /api/audio/speak` route using OpenAI TTS
- [ ] Add TTS play button to AI message bubbles
- [ ] Stream audio response to browser `<audio>` element
- [ ] Deduct credits for STT/TTS usage
- [ ] Add E2E test for voice transcription flow

---

## Mobile App (PWA)
> Plan: [doc/plans/mobile-pwa.md](../plans/mobile-pwa.md)

- [ ] Add `manifest.json` and app icons to `public/`
- [ ] Configure service worker (cache shell + API responses)
- [ ] Audit and fix mobile layout (sidebar, input, message list)
- [ ] Add `PushSubscription` table + migration
- [ ] Build push notification subscribe/unsubscribe flow
- [ ] Build `POST /api/push/send` internal route
- [ ] Trigger push for relevant async events (workflow done, etc.)
- [ ] Test install flow on iOS Safari and Android Chrome

---

## Analytics Dashboard
> Plan: [doc/plans/analytics-dashboard.md](../plans/analytics-dashboard.md)

- [ ] Add aggregate queries to `lib/db/queries.ts` (by model, by day, by cycle)
- [ ] Build `GET /api/analytics` route with period filter
- [ ] Build analytics page with credit burn-down chart
- [ ] Build model usage breakdown table/chart
- [ ] Build chat activity heatmap
- [ ] Add CSV export for usage data
- [ ] Add E2E test for analytics page load and data accuracy

---

## Webhook Notifications
> Plan: [doc/plans/webhook-notifications.md](../plans/webhook-notifications.md)

- [ ] Add `Webhook` and `WebhookDelivery` tables to schema
- [ ] Build webhook CRUD UI in settings
- [ ] Build `POST /api/settings/webhooks` route
- [ ] Implement HMAC-SHA256 payload signing utility
- [ ] Build webhook dispatcher workflow with retry/backoff
- [ ] Fire webhooks on relevant events (chat complete, payment, etc.)
- [ ] Build delivery log UI in settings
- [ ] Add E2E test for webhook registration and delivery

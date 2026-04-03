# Plan: Mobile App (PWA)

**Status:** Planned
**Priority:** Low

## Overview

Make Jikiro installable as a Progressive Web App on iOS and Android, providing a native-like experience with offline support and push notifications.

## Goals

- Installable via browser "Add to Home Screen"
- Mobile-optimized layout for chat and sidebar
- Push notifications for async events (workflow complete, shared chat reply)
- Basic offline support (cached shell, graceful offline message)

## Technical Considerations

- Add `manifest.json` to `app/` with icons, theme color, display mode
- Add `next-pwa` or custom service worker via `next.config.ts`
- Push notifications: Web Push API + VAPID keys, store subscriptions in DB
- New table: `PushSubscription` (`userId`, `endpoint`, `keys`)
- New route: `POST /api/push/subscribe` and `POST /api/push/send`
- Mobile layout: bottom navigation bar, collapsible sidebar

## Tasks

- [ ] Add `manifest.json` and app icons to `public/`
- [ ] Configure service worker (cache shell + API responses)
- [ ] Audit and fix mobile layout (sidebar, input, message list)
- [ ] Add `PushSubscription` table + migration
- [ ] Build push notification subscribe/unsubscribe flow
- [ ] Build `POST /api/push/send` internal route
- [ ] Trigger push for relevant async events (workflow done, etc.)
- [ ] Test install flow on iOS Safari and Android Chrome

# Plan: Analytics Dashboard

**Status:** Planned
**Priority:** Low

## Overview

A personal usage dashboard showing credit consumption, model usage breakdown, cost trends, and chat activity over time.

## Goals

- Credit burn-down chart per billing cycle
- Usage breakdown by model (messages, tokens, cost)
- Chat activity heatmap (messages per day)
- Exportable usage report (CSV)

## Technical Considerations

- Query `AiGenerationUsage` table — already tracks model, tokens, cost per generation
- Aggregate queries: group by model, day, billing cycle
- Chart library: use existing `framer-motion` or add lightweight charting (e.g. Recharts)
- New route: `GET /api/analytics?period=30d`
- Page: `app/settings/analytics/` or standalone `app/analytics/`

## Tasks

- [ ] Add aggregate queries to `lib/db/queries.ts` (by model, by day, by cycle)
- [ ] Build `GET /api/analytics` route with period filter
- [ ] Build analytics page with credit burn-down chart
- [ ] Build model usage breakdown table/chart
- [ ] Build chat activity heatmap
- [ ] Add CSV export for usage data
- [ ] Add E2E test for analytics page load and data accuracy

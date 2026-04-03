# Plan: Model Comparison

**Status:** Planned
**Priority:** Medium

## Overview

Run the same prompt against multiple AI models simultaneously and view responses side-by-side for direct comparison.

## Goals

- Select 2–4 models to compare from the model selector
- Single prompt sent to all selected models in parallel
- Responses stream in side-by-side columns
- Credits deducted per model used

## Technical Considerations

- New route: `POST /api/chat/compare` — accepts prompt + model list, fans out N streams
- UI: multi-column layout component (responsive, horizontal scroll on mobile)
- Reuse existing streaming infrastructure per model slot
- Each model response is an independent `useChat`-like stream
- Credit deduction fires per model as responses complete

## Tasks

- [ ] Build `POST /api/chat/compare` route (fan-out to N models)
- [ ] Build comparison layout UI (side-by-side columns)
- [ ] Add multi-model selector to trigger comparison mode
- [ ] Stream each model response independently into its column
- [ ] Show model name, latency, and token count per column
- [ ] Deduct credits per model on completion
- [ ] Add E2E test for 2-model comparison flow

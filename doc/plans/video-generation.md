# Plan: Video Generation

**Status:** Planned
**Priority:** High
**Entitlement:** `features.videoGeneration`

## Overview

Enable users to generate short video clips from text prompts using AI video models (e.g. RunwayML, Kling, Sora) directly inside the chat interface.

## Goals

- Users type a video prompt in chat and receive a generated video artifact
- Video renders inline in the chat as a playable artifact
- Generation is async — show progress indicator while rendering
- Gate behind plan entitlement

## Technical Considerations

- New artifact type: `video` (alongside existing `code`, `text`, `image`, `sheet`)
- Provider abstraction in `lib/ai/` for video generation APIs
- Async job — use Vercel Workflows for long-running generation
- Store generated video in S3, return signed URL
- Poll or stream progress back to client via SSE

## Tasks

- [ ] Add video provider abstraction to `lib/ai/providers.ts`
- [ ] Create `artifacts/video/` template and client component
- [ ] Build video generation workflow in `workflows/`
- [ ] Add video artifact rendering component (HTML5 `<video>` with controls)
- [ ] Stream generation progress to chat UI
- [ ] Upload final video to S3 and attach to message
- [ ] Gate behind `features.videoGeneration` entitlement
- [ ] Handle generation errors and quota exceeded
- [ ] Add E2E test for video generation flow

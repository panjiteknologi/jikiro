# Plan: Voice Input & TTS Output

**Status:** Planned
**Priority:** Low

## Overview

Users can speak to the assistant using microphone input (STT) and optionally have AI responses read aloud (TTS).

## Goals

- Push-to-talk or toggle mic button in chat input
- Transcribed text appears in message input before sending
- TTS: play button on each AI message to hear it read aloud
- Language auto-detected or user-selectable

## Technical Considerations

- STT: use Web Speech API (browser-native) or OpenAI Whisper API for accuracy
- TTS: OpenAI TTS API (`tts-1` model) or browser `SpeechSynthesis`
- New API route: `POST /api/audio/transcribe` (multipart audio → text)
- New API route: `POST /api/audio/speak` (text → audio stream)
- Audio playback in browser using `<audio>` element with streaming support
- Credit deduction for Whisper/TTS API calls

## Tasks

- [ ] Build mic capture UI (push-to-talk button in chat input)
- [ ] Build `POST /api/audio/transcribe` route using Whisper
- [ ] Insert transcribed text into chat input on completion
- [ ] Build `POST /api/audio/speak` route using OpenAI TTS
- [ ] Add TTS play button to AI message bubbles
- [ ] Stream audio response to browser `<audio>` element
- [ ] Deduct credits for STT/TTS usage
- [ ] Add E2E test for voice transcription flow

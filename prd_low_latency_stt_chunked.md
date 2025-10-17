# PRD — Low‑Latency STT (Chunked Whisper) for Ato

## 0) Context & Intent

We currently use a chained architecture (STT → LLM → TTS). TTS already streams in chunks and feels snappy. The bottleneck is **STT latency**. This PRD proposes a client‑side **chunked recording + pseudo‑streaming** pipeline (without migrating to WebRTC) that delivers partial transcripts during capture and a fast final transcript at end‑of‑speech.

> Team norms for this trial

- **Comments and code reviews in English.**
- **Respect existing project architecture** and style; changes should blend in (no “new dev smell”).
- Add telemetry, tests, and clear fallback paths.

---

## 1) Problem Statement

- Current STT records a full file → uploads once → waits for Whisper response. Latency is noticeable (hundreds of ms to seconds) before the UI can show any text.
- We need near‑real‑time partials while the user is speaking, and a rapid final transcript on release.

**Success criteria:**

- First partial text in **< 500 ms** after the user starts speaking on mid‑tier Android; **< 300 ms** on iOS high‑end.
- Continuous partial updates every **200–600 ms**.
- Final transcript **< 700 ms** after mic release (95th percentile).

---

## 2) Goals & Non‑Goals

**Goals**

1. Implement **chunked STT** using `expo-av` (no WebRTC migration).
2. Emit **partial transcripts** as the user speaks; switch to **finalized sentences** on punctuation.
3. Keep network open/persistent and push chunks immediately.
4. Provide clean abstractions: recording, chunk uploader, transcript assembler.

**Non‑Goals**

- Replacing the chained architecture.
- Migrating to Realtime/WebRTC.
- Server‑side diarization or advanced ASR features.

---

## 3) User Stories

- **As a user**, I want to see text appear while I’m talking so I know the app is listening.
- **As a user**, when I stop talking, I want the app to quickly finalize what I said and respond.
- **As an engineer**, I want clear logs and metrics to find latency spikes.

---

## 4) UX Requirements

- UI shows a **live transcript** (grey/“preview” style) that updates during capture.
- When a chunk returns with sentence‑ending punctuation (`. ! ? …`), that sentence becomes **final** (normal style).
- If the user releases the mic, finalize any tail text and proceed to LLM + TTS as today.
- Errors are non‑blocking and visible (small toast).

---

## 5) Architecture Overview

**Client (React Native, Expo)**

- **SegmentedRecorder** (A/B double‑buffer) built on `expo-av` to cut continuous audio into **small files** (200–600 ms) with no gaps.
- **WhisperChunker** to upload each chunk immediately to Whisper (`/audio/transcriptions`) using multipart; inject a short **prompt context** (last 120–200 chars) for continuity; merge results into a running transcript.
- **TranscriptAssembler** logic inside the chunker using simple heuristics to promote partials to final sentences.
- **Networking**: single persistent WS/HTTP client (keep‑alive). Each chunk labeled with `index` and timestamps.

**Server (existing)**

- No changes required. (Optional future: a small proxy for batching or token management.)

**Downstream**

- LLM (function calling) and TTS flow remains unchanged.

---

## 6) Data Flow

1. User taps mic → `SegmentedRecorder.start()`
2. Every 200–600 ms, recorder rotates buffers and emits a **chunk URI**.
3. `WhisperChunker.pushChunk(uri, ix)` uploads immediately with `{ model: "whisper-1", language, response_format: "text", prompt: <tail> }`.
4. Whisper returns **text for that chunk**. Heuristic:
   - If ends with punctuation → **commit** to final buffer; UI updates final text.
   - Else → update **preview** (buffer + latest partial); UI shows grey preview.
5. On mic release → stop recorder, cancel outstanding uploads, return **final text** (buffer).
6. Pipe final text to LLM → TTS (existing code).

---

## 7) API/Interfaces (Client)

### 7.1 Recording options (final)

```ts
// 24 kHz mono, 48 kbps — small files, good voice quality
export const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC_ELD,
    sampleRate: 24000, // fallback to 32000 if device issues
    numberOfChannels: 1,
    bitRate: 48000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 24000,
    numberOfChannels: 1,
    bitRate: 48000,
  },
}
```

### 7.2 SegmentedRecorder (A/B double buffer)

- `constructor(onChunk: (uri: string, ix: number) => void, options: Audio.RecordingOptions)`
- `start(): Promise<void>` — prepares A, starts A, preps B, starts interval rotation (default 400 ms)
- `stop(): Promise<void>` — stops timer and current recorder

### 7.3 WhisperChunker

- `constructor(language: 'es' | 'en', onPartial: (text: string, isFinal: boolean) => void)`
- `pushChunk(uri: string, ix: number): Promise<void>` — uploads chunk immediately; emits partial/final callbacks
- `cancelAll(): void`
- `getText(): string` — final accumulated text

### 7.4 RealtimeAgent additions

- `startListeningStreaming(language, onPartial)`
- `stopListeningStreaming(): Promise<string>`

---

## 8) Heuristics & Text Model

- **Finalization rule**: if chunk text ends in `[.!?…]`, mark as final.
- **Preview rule**: otherwise, show `buffer + latestChunk` as **preview** (light color); do not commit.
- **Prompt tail**: last **≤ 180 chars** of the current buffer to help continuity. Keep short to reduce request size.
- **Optional overlap** (phase 2): every ~1–2 s, send a longer chunk that includes ~200 ms del chunk previo; assembler descarta el solape al unir.

---

## 9) Latency Targets & Budget

- **Recorder rotate**: ≤ 20 ms
- **File ready (URI)**: ≤ 80 ms (Android worst) / ≤ 40 ms (iOS)
- **Upload per chunk**: ≤ 150 ms average (Wi‑Fi) — keep requests small
- **Whisper processing**: ≤ 150–250 ms per chunk
- **First partial on UI**: **< 500 ms** from speech start
- **Final after release**: **< 700 ms** p95

---

## 10) Telemetry & Observability

Emit timestamps for every chunk:

- `t0_recordStart`, `t1_chunkClosed`, `t2_uriReady`, `t3_uploadStart`, `t4_uploaded`, `t5_whisperResp`, `t6_uiUpdate`

Metrics:

- First partial latency, average per‑chunk latency, finalization latency, upload error rate, Whisper 4xx/5xx.

---

## 11) Error Handling & Fallbacks

- Network error on a chunk → skip quietly, keep streaming; show small toast if consecutive failures > N.
- Whisper non‑200 → retry once with exponential backoff; if still failing, pause and show prompt to retry.
- If mic stops unexpectedly → finalize what we have and continue.

---

## 12) Privacy & Security

- Do **not** expose API keys in client.
- If using a proxy, issue **ephemeral tokens** per session; store in memory only.
- Delete chunk files after successful upload (idempotent). Avoid long‑term storage.

---

## 13) Edge Cases

- Poca puntuación: textos sin punto → aplicar timeout de **1.2 s** para forzar finalización de la última oración.
- Ruido ambiental: chunk vacío → ignorar.
- Mic permission denied: fallback a input de texto.
- Android “encoder delay”: preferir 24/32 kHz + AAC‑ELD para minimizar.

---

## 14) Rollout Plan

1. **Phase A (behind flag)**: enable chunked STT only on dev builds; compare metrics vs baseline.
2. **Phase B (50%)**: enable for Android, then iOS.
3. **Phase C (100%)**: enable default; keep a runtime kill‑switch.

---

## 15) QA Plan

- Devices: Android mid‑tier (API 28–35), iOS A‑series.
- Networks: Wi‑Fi, 4G con 100–200 ms RTT.
- Tests:
  - First partial latency < target.
  - Finalization after release.
  - Consecutive chunk failures → graceful degradation.
  - Memory leaks (recording start/stop 50x).

---

## 16) Deliverables (MR Plan)

1. **MR#1 – Infra**: SegmentedRecorder + WhisperChunker + types; no UI wiring.
2. **MR#2 – UI**: hook `useStreamingSTT(onPartial)` + preview/final text rendering.
3. **MR#3 – Telemetry**: add timestamps/metrics + logs + dev toggle.
4. **MR#4 – Polish**: overlap opcional, error toasts, file cleanup, retries.

---

## 17) Acceptance Criteria

- Partial text appears within **< 500 ms** from speech start in 80% of sessions.
- Final transcript is produced within **< 700 ms** from mic release (p95).
- No noticeable audio gaps while recording (verified por logs de rotate).
- Errors no bloqueantes; UI conserva estabilidad.

---

## 18) Pseudo‑Code (Key Pieces)

**SegmentedRecorder (rotate loop)**

```ts
await a.prepare()
await a.start()
await b.prepare()
setInterval(async () => {
  const current = active === 'a' ? a : b
  const next = active === 'a' ? b : a
  await next.start()
  await current.stopAndUnload()
  onChunk(current.getURI(), ix++)
  await current.prepare()
  active = active === 'a' ? 'b' : 'a'
}, 400)
```

**WhisperChunker (upload)**

```ts
const prompt = tailCtx.slice(-180)
POST /audio/transcriptions multipart { model: whisper-1, language, response_format: text, prompt, file: chunk }
if (text.endsWith(/[.!?…]/)) { commit(text); onPartial(buffer, true) }
else { onPartial(buffer + ' ' + text, false) }
```

---

## 19) Open Questions

- ¿Necesitamos un **proxy** para firmar las requests a Whisper (tokens efímeros) o seguimos con la key en el server actual?
- ¿Implementamos **overlap** en v1 o lo dejamos para v1.1?
- ¿Guardamos el audio completo para un **"final pass"** opcional y corrección ortográfica?

---

## 20) Timeline (propuesta)

- Día 1–2: Infra (MR#1) + basic wiring.
- Día 3: UI + Telemetría (MR#2–#3).
- Día 4: Polish + QA smoke.

---

## 21) Risks & Mitigations

- **Variabilidad Android** (codecs/rates):
  - Mitigar con fallback a 32 kHz si 24 kHz falla.
- **Coste de API** por más requests:
  - Chunk size 400–600 ms, reintentos limitados, timeouts razonables.
- **Inestabilidad de red**:
  - Keep‑alive + backoff; mostrar preview local si se corta.

---

## 22) Implementation Notes

- Set `Audio.setAudioModeAsync(...)` **once** on app boot (not per chunk).
- Keep one persistent HTTP/WS client with keep‑alive.
- Delete chunk files after confirmed upload; do not block the rotate loop.
- Keep prompt tails short (≤ 180 chars) for latency.

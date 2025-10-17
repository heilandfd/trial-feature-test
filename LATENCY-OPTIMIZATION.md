# Voice Agent Latency Analysis & Optimization Proposals

## 📊 Current Flow & Latency Breakdown

### Sequential Pipeline (All blocking):

```
User stops speaking
    ↓
📱 Stop recording              ~100ms
    ↓
🎤 Whisper API (STT)          ~800ms - 2000ms  ← SLOW
    ↓
🤖 GPT-4o-mini (LLM)          ~1000ms - 3000ms ← SLOW
    ↓ (if function call)
🔧 Execute tool                ~0ms (mock) / ~500ms (real API)
    ↓
🤖 GPT-4o-mini again          ~1000ms - 2000ms ← SLOW
    ↓
🔊 OpenAI TTS                 ~1000ms - 2000ms ← SLOW
    ↓
📱 Download audio file         ~200ms - 500ms
    ↓
📱 Play response              ~2000ms - 5000ms (depends on length)
    ↓
⏰ 300ms delay
    ↓
🎤 Auto-listen starts
```

**Total Latency:**

- Simple response (no tools): **3s - 7s**
- With function call: **5s - 12s**

**User perception: TOO SLOW for "conversational"**

---

## 🚀 Optimization Proposals (Ranked by Impact)

### 1. STREAM LLM RESPONSES (High Impact)

**Current:**

```typescript
const response = await fetch('/chat/completions', {
  body: JSON.stringify({ model: 'gpt-4o-mini', messages, ... })
})
const result = await response.json()
return result.choices[0].message.content  // Wait for full response
```

**Proposed:**

```typescript
const response = await fetch('/chat/completions', {
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages,
    stream: true, // ← ENABLE STREAMING
  }),
})

let fullText = ''
for await (const chunk of response.body) {
  const delta = parseSSE(chunk)
  fullText += delta

  // Start TTS on first sentence
  if (hasCompleteSentence(fullText) && !ttsStarted) {
    startTTS(getFirstSentence(fullText)) // Don't await!
    ttsStarted = true
  }
}
```

**Impact:**

- ✅ Start playing audio MUCH earlier (as soon as first sentence is ready)
- ✅ Perceived latency: ~2-3s instead of 5-7s
- ✅ More conversational feel

**Complexity:** Medium
**Trade-offs:**

- More complex code (handle streaming)
- Need to buffer and parse SSE events
- Function calling with streaming is trickier

**Estimated gain: -3s to -4s** 🔥

---

### 2. PARALLELIZE TTS & CLEANUP (Medium Impact)

**Current (sequential):**

```typescript
const responseText = await processMessageWithLLM(...)  // Wait
const audioUri = await textToSpeech(responseText)     // Wait
await deleteAudioFile(inputAudioUri)                  // Wait
```

**Proposed (parallel):**

```typescript
const responseText = await processMessageWithLLM(...)

// Start TTS and cleanup in parallel
const [audioUri] = await Promise.all([
  textToSpeech(responseText),
  deleteAudioFile(inputAudioUri)  // Don't block on cleanup
])
```

**Impact:**

- ✅ Save ~200ms-500ms by not blocking on file deletion
- ✅ Simple change, low risk

**Complexity:** Low  
**Estimated gain: -300ms**

---

### 3. OPTIMIZE GPT PARAMETERS (Low Impact, Easy Win)

**Current:**

```typescript
max_tokens: 500,
temperature: 0.7
```

**Proposed:**

```typescript
max_tokens: 150,     // Shorter responses = faster + cheaper
temperature: 0.5,    // Lower temp = faster generation
```

**Impact:**

- ✅ Faster LLM responses (~20-30% faster)
- ✅ More concise answers (better for voice!)
- ✅ Cheaper API calls

**Complexity:** Trivial (change 2 numbers)  
**Trade-offs:**

- Shorter responses (might be TOO short for complex questions)
- Less creative (but we don't need creativity for caregiving assistant)

**Estimated gain: -500ms to -1s**

---

### 4. VOICE ACTIVITY DETECTION (High Impact on UX)

**Current:**

- User has to tap button to stop recording
- Adds manual step, breaks flow

**Proposed:**

```typescript
// Detect silence after user stops speaking
const silenceDetector = new SilenceDetector({
  threshold: -50dB,
  duration: 1500ms  // 1.5s of silence = done talking
})

silenceDetector.onSilence(() => {
  stopListening()  // Auto-stop!
})
```

**Impact:**

- ✅ **HUGE UX improvement** - truly hands-free
- ✅ More conversational (no button tapping)
- ✅ Feels more natural

**Complexity:** Medium
**Libraries needed:**

- Could use expo-av's audio analysis
- Or react-native-audio-level
- Or custom implementation

**Estimated UX gain: Massive (eliminates manual step)**

---

### 5. USE gpt-3.5-turbo INSTEAD OF gpt-4o-mini (Medium Impact)

**Current:**

```typescript
model: 'gpt-4o-mini' // Smart but slower
```

**Proposed:**

```typescript
model: 'gpt-3.5-turbo' // Faster, still good enough
```

**Impact:**

- ✅ ~40-50% faster LLM responses
- ✅ Much cheaper (10x cost reduction!)
- ⚠️ Slightly less intelligent (but probably fine for this use case)

**Complexity:** Trivial (change 1 string)  
**Estimated gain: -1s to -2s**

**Trade-off:** Need to test if quality is acceptable

---

### 6. REDUCE AUTO-LISTEN DELAY (Low Impact)

**Current:**

```typescript
setTimeout(() => startListening(), 300)
```

**Proposed:**

```typescript
setTimeout(() => startListening(), 100) // Or even 0
```

**Impact:**

- ✅ Faster loop restart
- ⚠️ Risk: Might pick up tail of own audio

**Complexity:** Trivial  
**Estimated gain: -200ms**

---

### 7. WHISPER OPTIMIZATION (Low Impact)

**Current:**

```typescript
// No optimization, default Whisper params
```

**Proposed:**

```typescript
formData.append('prompt', previousTranscript) // Context for better accuracy
formData.append('temperature', '0') // Faster, deterministic
```

**Impact:**

- ✅ Slightly faster Whisper
- ✅ Better accuracy with context

**Complexity:** Low  
**Estimated gain: -200ms**

---

### 8. PRE-GENERATE COMMON RESPONSES (Medium Impact)

**Idea:**
Pre-generate TTS audio for common phrases:

- "I didn't catch that"
- "Let me check that for you"
- "How else can I help?"

**Implementation:**

```typescript
const CACHED_AUDIO = {
  didnt_catch: 'file://cached/didnt_catch_en.mp3',
  checking: 'file://cached/checking_en.mp3',
  // ...
}

// In TTS function:
if (isCommonPhrase(text)) {
  return CACHED_AUDIO[phraseKey] // Instant!
}
```

**Impact:**

- ✅ Instant TTS for common phrases
- ✅ Better UX for errors/confirmations

**Complexity:** Medium  
**Estimated gain: -2s for cached phrases**

---

### 9. OPTIMISTIC UI UPDATES (Medium Impact on UX)

**Current:**

- Show "Thinking..." and wait for everything

**Proposed:**

- Show transcribed text immediately (before LLM)
- Show partial responses as they come in (with streaming)

**Implementation:**

```typescript
// Show user's transcribed message immediately
setMessages([...userMessage]) // Don't wait for LLM

// Then add assistant response when ready
```

**Impact:**

- ✅ User sees feedback MUCH faster
- ✅ Feels more responsive
- ⚠️ Might show incorrect transcription briefly

**Complexity:** Low  
**UX gain: Feels 2x faster**

---

### 10. PARALLEL STT + TTS PREP (Low Impact)

**Idea:**
While Whisper is transcribing, pre-warm TTS connection

**Implementation:**

```typescript
const [transcribedText] = await Promise.all([
  transcribeAudio(uri),
  warmupTTS(), // Pre-connect to TTS API
])
```

**Impact:**

- ✅ TTS connection already established when needed
- Small gain but low effort

**Complexity:** Low  
**Estimated gain: -200ms**

---

## 🎯 Recommended Implementation Plan

### Phase 1: Quick Wins (< 1 hour)

1. **Optimize GPT params** → `-1s`
   - `max_tokens: 500` → `150`
   - `temperature: 0.7` → `0.5`

2. **Parallelize cleanup** → `-300ms`
   - Don't block on `deleteAudioFile`

3. **Reduce auto-listen delay** → `-200ms`
   - `300ms` → `100ms`

4. **Optimistic UI** → Feels 2x faster
   - Show transcribed text immediately

**Total gain: ~1.5s + better perceived performance**

---

### Phase 2: Medium Effort (2-4 hours)

5. **Implement streaming** → `-3s to -4s`
   - Stream GPT responses
   - Start TTS on first complete sentence
   - This is the BIG win

6. **Try gpt-3.5-turbo** → `-1s to -2s`
   - Test if quality is acceptable
   - If yes, huge speed + cost improvement

**Total gain: -4s to -6s**

---

### Phase 3: Advanced (4-8 hours)

7. **Voice Activity Detection** → Massive UX improvement
   - Auto-stop recording when silence detected
   - Eliminates manual button tap
   - Truly hands-free

8. **Cache common responses** → -2s for common phrases
   - Pre-generate TTS for frequent responses

**Total UX gain: Feels natural and instant**

---

## 💡 My Top 3 Recommendations

### 🥇 #1: Stream GPT + Start TTS Early

**Why:** This is the single biggest latency reduction possible.

**How it works:**

```
User stops → Whisper (2s) → First sentence from GPT (1s) → START TTS
                          → Rest of GPT (2s) → Append to TTS

Instead of waiting 5s, audio starts at 3s
```

**Effort:** Medium (3-4 hours)  
**Gain:** -3s perceived latency

---

### 🥈 #2: Optimize GPT Params + Model Test

**Why:** Easiest to implement, immediate gains.

**Changes:**

```typescript
model: 'gpt-3.5-turbo',  // Try this first
max_tokens: 150,
temperature: 0.5
```

**Effort:** 10 minutes  
**Gain:** -1s to -2s

---

### 🥉 #3: Voice Activity Detection

**Why:** Makes it truly conversational - no button tapping.

**Implementation:**

- Monitor audio levels during recording
- Auto-stop after 1.5s of silence
- User just talks naturally

**Effort:** Medium-High (4-6 hours)  
**UX Gain:** Massive (hands-free!)

---

## 🤔 Questions to Consider

**1. How short can responses be?**

- If we go `max_tokens: 150`, will responses be too terse?
- Need to test with real conversations

**2. Is gpt-3.5-turbo good enough?**

- For simple questions, probably yes
- For complex caregiving advice, might lose quality
- Worth A/B testing

**3. Is streaming worth the complexity?**

- Adds ~200 lines of code
- Breaks current clean architecture
- But saves 3-4 seconds...

**4. VAD false positives?**

- What if user pauses mid-sentence?
- Need good threshold tuning
- Might need "I'm still talking" UX

---

## 📈 Expected Results by Phase

**Current:** 5-7s avg latency  
**After Phase 1:** 3.5-5s (-1.5s to -2s)  
**After Phase 2:** 1.5-2s (-4s to -5s)  
**After Phase 3:** Feels instant (< 1s perceived)

---

## 🎯 My Recommendation

**Start with Phase 1** (quick wins):

1. Change GPT params (10 mins)
2. Parallelize cleanup (10 mins)
3. Optimistic UI (30 mins)
4. Test

**If more speed needed:**

- Implement streaming (biggest gain)
- Then VAD (best UX)

**Don't do:**

- Switch to gpt-3.5-turbo without testing (might hurt quality)

---

**Want me to implement Phase 1?** It's low-risk, quick, and gives immediate improvement. 🚀

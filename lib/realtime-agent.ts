/**
 * OpenAI Realtime Agent (Chained Architecture)
 *
 * This implements the chained approach recommended by OpenAI:
 * https://platform.openai.com/docs/guides/voice-agents?voice-agent-architecture=chained
 *
 * Flow:
 * 1. Speech-to-Text (Whisper API)
 * 2. LLM Processing (GPT-4o-mini with function calling)
 * 3. Text-to-Speech (OpenAI TTS API)
 *
 * Why Chained vs Speech-to-Speech:
 * - More control over each step
 * - Text is visible in chat (better UX)
 * - Easier debugging
 * - Can use different providers if needed
 * - Function calling well-supported
 */

import { Audio } from 'expo-av'
import type { Message } from '../types/assistant'
import { allTools, executeTool } from './tools-definitions'
import {
  startRecording,
  stopRecording,
  deleteAudioFile,
  playAudio,
  stopAudio,
  requestMicrophonePermission,
} from './audio-utils'
import { getSystemPrompt } from './ai-prompts'
import ReactNativeBlobUtil from 'react-native-blob-util'

// OpenAI API configuration
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY
const OPENAI_API_BASE = 'https://api.openai.com/v1'

if (!OPENAI_API_KEY) {
  console.warn('[RealtimeAgent] Missing EXPO_PUBLIC_OPENAI_API_KEY')
}

/**
 * Transcribe audio to text using OpenAI Whisper
 *
 * @param audioUri - URI of the audio file to transcribe
 * @param language - Language code ('en' or 'es')
 * @param prompt - Optional context from previous message for better accuracy
 * @returns Promise<string> - Transcribed text
 */
export async function transcribeAudio(
  audioUri: string,
  language: string,
  prompt?: string
): Promise<string> {
  try {
    // Detect format from URI (.wav for iOS PCM, .m4a for Android AAC)
    const isWav = audioUri.endsWith('.wav')

    const formData = new FormData()
    formData.append('file', {
      uri: audioUri,
      type: isWav ? 'audio/wav' : 'audio/m4a',
      name: isWav ? 'audio.wav' : 'audio.m4a',
    } as any)
    formData.append('model', 'whisper-1')
    formData.append('language', language)
    formData.append('response_format', 'text') // Faster than json
    formData.append('temperature', '0') // Deterministic, faster

    // Add context from previous message for better accuracy
    if (prompt && prompt.trim()) {
      formData.append('prompt', prompt.substring(0, 200)) // Max 200 chars
    }

    const response = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`)
    }

    // response_format='text' returns plain text, not JSON
    const text = await response.text()
    return text
  } catch (error) {
    console.error('[RealtimeAgent] Transcription error:', error)
    throw new Error(
      'Failed to transcribe audio: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
}

/**
 * Helper: Check if text has complete sentence
 */
function hasCompleteSentence(text: string): boolean {
  return /[.!?]\s+\S/.test(text) || /[.!?]$/.test(text.trim())
}

/**
 * Helper: Extract first complete sentence
 */
function getFirstSentence(text: string): string {
  const match = text.match(/^(.+?[.!?])/)
  return match ? match[1].trim() : text
}

/**
 * Process message with LLM (GPT-4o-mini) with streaming support
 *
 * Handles:
 * - General conversation
 * - Intent detection
 * - Function calling (tools)
 * - Streaming responses for lower latency
 * - Optional callback for early TTS
 *
 * @param userMessage - User's message text
 * @param history - Conversation history
 * @param context - Context (user info, auth token, etc.)
 * @param onFirstSentence - Callback fired when first complete sentence is ready
 * @returns Promise<string> - AI response text
 */
export async function processMessageWithLLM(
  userMessage: string,
  history: Message[],
  context: {
    managerName: string
    userName: string
    language: string
    userId?: string
    authToken?: string
  },
  onFirstSentence?: (sentence: string) => void
): Promise<string> {
  try {
    // Convert message history to OpenAI format
    const messages = [
      {
        role: 'system' as const,
        content: getSystemPrompt(context.managerName, context.userName, context.language),
      },
      ...history.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: userMessage,
      },
    ]

    // Use XMLHttpRequest for streaming (React Native compatible)
    const fullText = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      let buffer = ''
      let accumulated = ''
      let functionCall: any = null
      let firstSentenceFired = false

      xhr.open('POST', `${OPENAI_API_BASE}/chat/completions`)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.setRequestHeader('Authorization', `Bearer ${OPENAI_API_KEY}`)

      xhr.onprogress = () => {
        // Get new data
        const newData = xhr.responseText.slice(buffer.length)
        buffer = xhr.responseText

        // Parse SSE chunks
        const lines = newData.split('\n')
        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue
          if (!line.startsWith('data: ')) continue

          try {
            const data = JSON.parse(line.slice(6))
            const delta = data.choices[0].delta

            // Check for function call
            if (delta.function_call) {
              if (!functionCall) {
                functionCall = { name: delta.function_call.name || '', arguments: '' }
              }
              if (delta.function_call.arguments) {
                functionCall.arguments += delta.function_call.arguments
              }
            }

            // Accumulate content
            if (delta.content) {
              accumulated += delta.content

              // Fire callback when we have enough text (for early TTS)
              // Strategy: Wait for 30+ chars with complete sentence
              if (!firstSentenceFired && !functionCall && onFirstSentence) {
                if (accumulated.length >= 30 && hasCompleteSentence(accumulated)) {
                  const firstSentence = getFirstSentence(accumulated)
                  onFirstSentence(firstSentence)
                  firstSentenceFired = true
                }
              }
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Return both accumulated text and function call
          resolve(JSON.stringify({ text: accumulated, functionCall }))
        } else {
          reject(new Error(`OpenAI API error: ${xhr.status} - ${xhr.responseText}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error'))

      xhr.send(
        JSON.stringify({
          model: 'gpt-3.5-turbo', // Faster model for lower latency
          messages,
          functions: allTools,
          function_call: 'auto',
          max_tokens: 500,
          temperature: 0.7,
          stream: true,
        })
      )
    })

    // Parse result
    const result = JSON.parse(fullText)
    const accumulated = result.text
    const functionCall = result.functionCall

    // Check if LLM wants to call a function
    if (functionCall && functionCall.name) {
      const functionName = functionCall.name
      const functionArgs = JSON.parse(functionCall.arguments)

      console.log('[RealtimeAgent] Function call:', functionName)

      // Execute the tool
      const toolResult = await executeTool(functionName, functionArgs, {
        authToken: context.authToken,
        userId: context.userId,
        locale: context.language === 'es' ? 'es-ES' : 'en-US',
      })

      // Call LLM again with function result (also with streaming)
      const messagesWithToolResult = [
        ...messages,
        {
          role: 'assistant' as const,
          content: null as any,
          function_call: functionCall,
        },
        {
          role: 'function' as const,
          name: functionName,
          content: JSON.stringify(toolResult),
        },
      ]

      // Second XMLHttpRequest for function result response
      const finalText = await new Promise<string>((resolve, reject) => {
        const xhr2 = new XMLHttpRequest()

        let buffer2 = ''
        let accumulated2 = ''

        xhr2.open('POST', `${OPENAI_API_BASE}/chat/completions`)
        xhr2.setRequestHeader('Content-Type', 'application/json')
        xhr2.setRequestHeader('Authorization', `Bearer ${OPENAI_API_KEY}`)

        xhr2.onprogress = () => {
          const newData = xhr2.responseText.slice(buffer2.length)
          buffer2 = xhr2.responseText

          const lines = newData.split('\n')
          for (const line of lines) {
            if (line.trim() === '' || line.trim() === 'data: [DONE]') continue
            if (!line.startsWith('data: ')) continue

            try {
              const data = JSON.parse(line.slice(6))
              if (data.choices[0].delta.content) {
                accumulated2 += data.choices[0].delta.content
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        xhr2.onload = () => {
          if (xhr2.status >= 200 && xhr2.status < 300) {
            resolve(accumulated2)
          } else {
            reject(new Error(`OpenAI API error: ${xhr2.status}`))
          }
        }

        xhr2.onerror = () => reject(new Error('Network error'))

        xhr2.send(
          JSON.stringify({
            model: 'gpt-3.5-turbo', // Faster model for lower latency
            messages: messagesWithToolResult,
            max_tokens: 500,
            temperature: 0.7,
            stream: true,
          })
        )
      })

      return finalText
    }

    // No function call, return streamed response
    return accumulated
  } catch (error) {
    console.error('[RealtimeAgent] LLM processing error:', error)
    throw new Error(
      'Failed to process message: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
}

/**
 * Convert text to speech using OpenAI TTS
 *
 * @param text - Text to convert to speech
 * @param language - Language code ('en' or 'es')
 * @returns Promise<string> - URI of the audio file
 */
export async function textToSpeech(text: string, language: string): Promise<string> {
  try {
    const fileName = `tts_response_${Date.now()}.mp3`
    const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`

    const response = await ReactNativeBlobUtil.config({
      path: filePath,
      fileCache: true,
    }).fetch(
      'POST',
      `${OPENAI_API_BASE}/audio/speech`,
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'alloy',
        response_format: 'mp3',
        speed: 1.0,
      })
    )

    if (response.respInfo.status !== 200) {
      throw new Error(`TTS API error: ${response.respInfo.status}`)
    }

    return `file://${response.path()}`
  } catch (error) {
    console.error('[RealtimeAgent] TTS error:', error)
    throw new Error(
      'Failed to generate speech: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
}

/**
 * Main Realtime Agent Class
 *
 * Manages the complete voice interaction flow:
 * 1. Record user voice
 * 2. Transcribe to text
 * 3. Process with LLM
 * 4. Convert response to speech
 * 5. Play response
 */
export class RealtimeAgent {
  private recording: Audio.Recording | null = null
  private currentSound: Audio.Sound | null = null
  private isRecording: boolean = false
  private isSpeaking: boolean = false

  /**
   * Request microphone permission
   *
   * @returns Promise<boolean> - true if granted
   */
  async requestPermission(): Promise<boolean> {
    return requestMicrophonePermission()
  }

  /**
   * Start recording user voice
   *
   * @returns Promise<void>
   * @throws Error if recording fails
   */
  async startListening(): Promise<void> {
    if (this.isRecording) {
      return
    }

    try {
      this.recording = await startRecording()
      this.isRecording = true
    } catch (error) {
      console.error('[RealtimeAgent] Failed to start listening:', error)
      this.isRecording = false
      throw error
    }
  }

  /**
   * Stop recording and get audio file (for optimistic UI flow)
   *
   * @returns Promise<string> - URI of recorded audio file
   */
  async stopRecordingAndGetAudio(): Promise<string> {
    if (!this.recording || !this.isRecording) {
      throw new Error('No active recording')
    }

    try {
      const audioUri = await stopRecording(this.recording)
      this.isRecording = false
      this.recording = null
      return audioUri
    } catch (error) {
      console.error('[RealtimeAgent] Error stopping recording:', error)
      this.isRecording = false
      this.recording = null
      throw error
    }
  }

  /**
   * Transcribe audio (public method for optimistic UI)
   */
  async transcribeAudio(audioUri: string, language: string, prompt?: string): Promise<string> {
    return transcribeAudio(audioUri, language, prompt)
  }

  /**
   * Process with LLM (public method for optimistic UI)
   */
  async processWithLLM(
    text: string,
    history: Message[],
    context: {
      managerName: string
      userName: string
      language: string
      userId?: string
      authToken?: string
    },
    onFirstSentence?: (sentence: string) => void
  ): Promise<string> {
    return processMessageWithLLM(text, history, context, onFirstSentence)
  }

  /**
   * Generate TTS (public method for optimistic UI)
   */
  async textToSpeech(text: string, language: string): Promise<string> {
    return textToSpeech(text, language)
  }

  /**
   * Cleanup audio file (wrapper for deleteAudioFile)
   */
  async cleanupAudioFile(uri: string): Promise<void> {
    return deleteAudioFile(uri)
  }

  /**
   * Stop recording and process voice message
   *
   * Complete flow:
   * 1. Stop recording
   * 2. Transcribe audio (Whisper)
   * 3. Process with LLM
   * 4. Generate TTS
   * 5. Return transcribed text and response text
   *
   * @param history - Conversation history
   * @param context - Context for LLM
   * @returns Promise<{ transcribedText: string, responseText: string, responseAudioUri: string }>
   */
  async stopListeningAndProcess(
    history: Message[],
    context: {
      managerName: string
      userName: string
      language: string
      userId?: string
      authToken?: string
    }
  ): Promise<{
    transcribedText: string
    responseText: string
    responseAudioUri: string
  }> {
    if (!this.recording || !this.isRecording) {
      throw new Error('No active recording')
    }

    try {
      // 1. Stop recording and get audio file
      const audioUri = await stopRecording(this.recording)
      this.isRecording = false
      this.recording = null

      // 2. Transcribe audio to text (Whisper)
      const transcribedText = await transcribeAudio(
        audioUri,
        context.language === 'es' ? 'es' : 'en'
      )

      // 3. Process with LLM (may include function calling)
      const responseText = await processMessageWithLLM(transcribedText, history, context)

      // 4. Convert response to speech AND cleanup in parallel (no need to block on cleanup)
      const [responseAudioUri] = await Promise.all([
        textToSpeech(responseText, context.language),
        deleteAudioFile(audioUri), // Cleanup in background
      ])

      return {
        transcribedText,
        responseText,
        responseAudioUri,
      }
    } catch (error) {
      console.error('[RealtimeAgent] Error in stopListeningAndProcess:', error)
      this.isRecording = false
      this.recording = null
      throw error
    }
  }

  /**
   * Cancel current recording without processing
   */
  async cancelRecording(): Promise<void> {
    if (!this.recording) {
      // No recording to cancel
      this.isRecording = false
      return
    }

    try {
      const uri = await stopRecording(this.recording)
      await deleteAudioFile(uri)
    } catch {
      // Silently ignore errors - recording may already be stopped or cleaned up
    } finally {
      this.isRecording = false
      this.recording = null
    }
  }

  /**
   * Play AI response audio
   *
   * Waits until audio finishes playing before resolving
   *
   * @param audioUri - URI of audio file to play
   */
  async playResponse(audioUri: string): Promise<void> {
    if (this.isSpeaking) {
      await this.stopSpeaking()
    }

    return new Promise<void>(async (resolve, reject) => {
      try {
        this.currentSound = await playAudio(audioUri)
        this.isSpeaking = true

        this.currentSound.setOnPlaybackStatusUpdate(status => {
          if (status.isLoaded && status.didJustFinish) {
            this.isSpeaking = false
            deleteAudioFile(audioUri).catch(console.error)
            resolve() // Resolve promise when audio finishes
          }
        })
      } catch (error) {
        console.error('[RealtimeAgent] Error playing response:', error)
        this.isSpeaking = false
        reject(error)
      }
    })
  }

  /**
   * Stop currently playing audio
   */
  async stopSpeaking(): Promise<void> {
    if (this.currentSound && this.isSpeaking) {
      try {
        await stopAudio(this.currentSound)
        this.isSpeaking = false
        this.currentSound = null
      } catch (error) {
        console.error('[RealtimeAgent] Error stopping speaking:', error)
        this.isSpeaking = false
        this.currentSound = null
      }
    }
  }

  /**
   * Process text message (without voice input)
   *
   * For when user types instead of speaking.
   *
   * @param message - User's text message
   * @param history - Conversation history
   * @param context - Context for LLM
   * @param withVoice - Whether to generate and play TTS
   * @returns Promise<{ responseText: string, responseAudioUri?: string }>
   */
  async processTextMessage(
    message: string,
    history: Message[],
    context: {
      managerName: string
      userName: string
      language: string
      userId?: string
      authToken?: string
    },
    withVoice: boolean = false
  ): Promise<{
    responseText: string
    responseAudioUri?: string
  }> {
    try {
      const responseText = await processMessageWithLLM(message, history, context)

      let responseAudioUri: string | undefined
      if (withVoice) {
        responseAudioUri = await textToSpeech(responseText, context.language)
      }

      return {
        responseText,
        responseAudioUri,
      }
    } catch (error) {
      console.error('[RealtimeAgent] Error processing text message:', error)
      throw error
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isRecording: this.isRecording,
      isSpeaking: this.isSpeaking,
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.cancelRecording()
    await this.stopSpeaking()
  }
}

// Export singleton instance
export const realtimeAgent = new RealtimeAgent()

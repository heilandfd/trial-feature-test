/**
 * OpenAI Realtime Agent (Chained Architecture)
 *
 * This implements the "chained" approach recommended by OpenAI:
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
import { allTools, executeTool, type ToolResult } from './tools-definitions'
import {
  startRecording,
  stopRecording,
  readAudioAsBase64,
  deleteAudioFile,
  playAudio,
  stopAudio,
  base64ToAudioUri,
  requestMicrophonePermission,
} from './audio-utils'

// OpenAI API configuration
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY
const OPENAI_API_BASE = 'https://api.openai.com/v1'

if (!OPENAI_API_KEY) {
  console.warn('[RealtimeAgent] Missing EXPO_PUBLIC_OPENAI_API_KEY')
}

/**
 * System prompt for the Ato assistant
 *
 * Defines personality, context, and behavior.
 */
function getSystemPrompt(managerName: string, userName: string, language: string): string {
  if (language === 'es') {
    return `Eres Ato, un asistente de IA amigable y útil para cuidadores familiares.

Contexto:
- Estás hablando con ${managerName}, un cuidador/familiar (el "manager")
- ${managerName} está cuidando a ${userName}, su familiar anciano (el "usuario")
- ${userName} tiene un dispositivo Ato que lo ayuda con tareas diarias

Tu personalidad:
- Cálido, amigable y empático
- Profesional pero no robótico  
- Conciso pero completo
- Proactivo en ofrecer ayuda

Herramientas disponibles:
- getUserReport: Obtener reporte de actividad de ${userName} (recordatorios, contactos, etc.)
- getCurrentTime: Obtener hora actual

Directrices:
- Mantén respuestas concisas (2-3 oraciones máximo)
- Sé respetuoso de la privacidad de ${userName}
- Si no estás seguro, haz preguntas aclaratorias
- Para chat general, sé amigable y útil
- Cuando uses herramientas, explica lo que encontraste de forma natural

Ejemplos:
Usuario: "¿Cómo está mamá?"
Asistente: [llama getUserReport] "Tu mamá está bien! Tiene 3 recordatorios pendientes y ha estado en contacto con 2 personas hoy. ¿Quieres más detalles?"

Usuario: "¿Qué hora es?"
Asistente: [llama getCurrentTime] "Son las 3:45 PM."

Usuario: "Hola"
Asistente: "¡Hola! Soy Ato, tu asistente. Puedo ayudarte a revisar cómo está ${userName}, gestionar sus recordatorios, o responder preguntas. ¿En qué puedo ayudarte?"`
  }

  return `You are Ato, a friendly and helpful AI assistant for family caregivers.

Context:
- You are speaking with ${managerName}, a caregiver/family member (the "manager")
- ${managerName} is caring for ${userName}, their elderly family member (the "user")
- ${userName} has an Ato device that helps them with daily tasks

Your personality:
- Warm, friendly, and empathetic
- Professional but not robotic
- Concise but thorough
- Proactive in offering help

Available tools:
- getUserReport: Get activity report for ${userName} (reminders, contacts, etc.)
- getCurrentTime: Get current time

Guidelines:
- Keep responses concise (2-3 sentences max)
- Be respectful of ${userName}'s privacy
- If unsure, ask clarifying questions
- For general chat, be friendly and helpful
- When using tools, explain what you found naturally

Examples:
User: "How is mom doing?"
Assistant: [calls getUserReport] "Your mom is doing well! She has 3 upcoming reminders and has been in contact with 2 people today. Would you like more details?"

User: "What time is it?"
Assistant: [calls getCurrentTime] "It's currently 3:45 PM."

User: "Hello"
Assistant: "Hello! I'm Ato, your assistant. I can help you check on ${userName}, manage their reminders, or answer questions. How can I help you today?"`
}

/**
 * Transcribe audio to text using OpenAI Whisper
 *
 * @param audioUri - URI of the audio file to transcribe
 * @param language - Language code ('en' or 'es')
 * @returns Promise<string> - Transcribed text
 */
async function transcribeAudio(audioUri: string, language: string): Promise<string> {
  try {
    console.log('[RealtimeAgent] Transcribing audio with Whisper...')

    // Read audio file as base64
    const audioBase64 = await readAudioAsBase64(audioUri)

    // Convert base64 to blob for upload
    const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
    const blob = new Blob([audioData], { type: 'audio/wav' })

    // Create form data
    const formData = new FormData()
    formData.append('file', blob, 'audio.wav')
    formData.append('model', 'whisper-1')
    formData.append('language', language)

    // Call Whisper API
    const response = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    const transcribedText = result.text

    console.log('[RealtimeAgent] Transcription successful:', transcribedText)
    return transcribedText
  } catch (error) {
    console.error('[RealtimeAgent] Transcription error:', error)
    throw new Error(
      'Failed to transcribe audio: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
}

/**
 * Process message with LLM (GPT-4o-mini)
 *
 * Handles:
 * - General conversation
 * - Intent detection
 * - Function calling (tools)
 *
 * @param userMessage - User's message text
 * @param history - Conversation history
 * @param context - Context (user info, auth token, etc.)
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
  }
): Promise<string> {
  try {
    console.log('[RealtimeAgent] Processing message with LLM...')

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

    // Call GPT-4o-mini with function calling
    let response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        functions: allTools,
        function_call: 'auto',
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    const choice = result.choices[0]

    // Check if LLM wants to call a function
    if (choice.message.function_call) {
      const functionCall = choice.message.function_call
      const functionName = functionCall.name
      const functionArgs = JSON.parse(functionCall.arguments)

      console.log('[RealtimeAgent] LLM requested function call:', functionName, functionArgs)

      // Execute the tool
      const toolResult = await executeTool(functionName, functionArgs, {
        authToken: context.authToken,
        locale: context.language === 'es' ? 'es-ES' : 'en-US',
      })

      console.log('[RealtimeAgent] Tool execution result:', toolResult)

      // Call LLM again with function result
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

      response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messagesWithToolResult,
          max_tokens: 500,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      }

      const finalResult = await response.json()
      const finalResponse = finalResult.choices[0].message.content

      console.log('[RealtimeAgent] LLM final response after tool call:', finalResponse)
      return finalResponse
    }

    // No function call, return direct response
    const responseText = choice.message.content
    console.log('[RealtimeAgent] LLM response:', responseText)
    return responseText
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
    console.log('[RealtimeAgent] Converting text to speech...')

    // Call OpenAI TTS API
    const response = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3',
        speed: 1.0,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TTS API error: ${response.status} - ${errorText}`)
    }

    // Get audio data as base64
    const audioBlob = await response.blob()
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Convert to file URI
    const audioUri = await base64ToAudioUri(base64Audio, 'mp3')

    console.log('[RealtimeAgent] TTS successful, audio file:', audioUri)
    return audioUri
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
      console.warn('[RealtimeAgent] Already recording')
      return
    }

    try {
      console.log('[RealtimeAgent] Starting to listen...')
      this.recording = await startRecording()
      this.isRecording = true
      console.log('[RealtimeAgent] Listening started')
    } catch (error) {
      console.error('[RealtimeAgent] Failed to start listening:', error)
      this.isRecording = false
      throw error
    }
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
      console.log('[RealtimeAgent] Stopping recording and processing...')

      // 1. Stop recording and get audio file
      const audioUri = await stopRecording(this.recording)
      this.isRecording = false
      this.recording = null

      console.log('[RealtimeAgent] Audio file saved:', audioUri)

      // 2. Transcribe audio to text (Whisper)
      const transcribedText = await transcribeAudio(
        audioUri,
        context.language === 'es' ? 'es' : 'en'
      )

      console.log('[RealtimeAgent] Transcription:', transcribedText)

      // 3. Process with LLM (may include function calling)
      const responseText = await processMessageWithLLM(transcribedText, history, context)

      console.log('[RealtimeAgent] LLM response:', responseText)

      // 4. Convert response to speech
      const responseAudioUri = await textToSpeech(responseText, context.language)

      console.log('[RealtimeAgent] TTS complete:', responseAudioUri)

      // 5. Clean up input audio file
      await deleteAudioFile(audioUri)

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
    if (this.recording && this.isRecording) {
      try {
        const uri = await stopRecording(this.recording)
        await deleteAudioFile(uri)
        this.isRecording = false
        this.recording = null
        console.log('[RealtimeAgent] Recording cancelled')
      } catch (error) {
        console.error('[RealtimeAgent] Error cancelling recording:', error)
        this.isRecording = false
        this.recording = null
      }
    }
  }

  /**
   * Play AI response audio
   *
   * @param audioUri - URI of audio file to play
   */
  async playResponse(audioUri: string): Promise<void> {
    if (this.isSpeaking) {
      await this.stopSpeaking()
    }

    try {
      console.log('[RealtimeAgent] Playing response...')
      this.currentSound = await playAudio(audioUri)
      this.isSpeaking = true

      // Set up listener for when playback finishes
      this.currentSound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          this.isSpeaking = false
          console.log('[RealtimeAgent] Playback finished')
          // Clean up audio file after playing
          deleteAudioFile(audioUri).catch(console.error)
        }
      })
    } catch (error) {
      console.error('[RealtimeAgent] Error playing response:', error)
      this.isSpeaking = false
      throw error
    }
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
        console.log('[RealtimeAgent] Speaking stopped')
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
      console.log('[RealtimeAgent] Processing text message...')

      // 1. Process with LLM
      const responseText = await processMessageWithLLM(message, history, context)

      console.log('[RealtimeAgent] LLM response:', responseText)

      // 2. Optionally generate TTS
      let responseAudioUri: string | undefined

      if (withVoice) {
        responseAudioUri = await textToSpeech(responseText, context.language)
        console.log('[RealtimeAgent] TTS generated:', responseAudioUri)
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

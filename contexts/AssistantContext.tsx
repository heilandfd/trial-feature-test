import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import type { Message, AssistantState } from '../types/assistant'
import { useI18n } from '../components/I18nProvider'
import { useAuth } from '../components/AuthProvider'
import { useAto } from './AtoContext'
import { realtimeAgent } from '../lib/realtime-agent'
import { requestMicrophonePermission } from '../lib/audio-utils'

interface AssistantContextType {
  // State
  messages: Message[]
  state: AssistantState

  // Actions
  openAssistant: () => void
  closeAssistant: () => void
  sendMessage: (content: string, withVoice?: boolean) => Promise<void>
  sendVoiceMessage: () => Promise<void>
  startListening: () => Promise<void>
  stopListening: () => Promise<void>
  cancelListening: () => void
  stopSpeaking: () => void
  clearMessages: () => void
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined)

export const useAssistant = () => {
  const context = useContext(AssistantContext)
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider')
  }
  return context
}

interface AssistantProviderProps {
  children: ReactNode
}

export const AssistantProvider: React.FC<AssistantProviderProps> = ({ children }) => {
  const { t, language } = useI18n()
  const { user, session } = useAuth()
  const { currentManager, selectedUser } = useAto()
  const [messages, setMessages] = useState<Message[]>([])
  const [state, setState] = useState<AssistantState>({
    isOpen: false,
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    isConversationalMode: false,
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      realtimeAgent.cleanup()
    }
  }, [])

  const openAssistant = () => {
    setState(prev => ({ ...prev, isOpen: true }))
  }

  const closeAssistant = () => {
    setState(prev => ({ ...prev, isOpen: false, isConversationalMode: false }))
    realtimeAgent.stopSpeaking()
  }

  /**
   * Get context for LLM
   */
  const getContext = () => {
    const managerName = currentManager?.nickname || user?.email?.split('@')[0] || 'Manager'
    const userName = selectedUser?.nickname || 'your family member'
    // assume the user id is the manager id if user id is missing
    const userId = selectedUser?.id || currentManager?.id || user?.id
    const authToken = session?.access_token

    return {
      managerName,
      userName,
      language: language || 'en',
      userId,
      authToken,
    }
  }

  /**
   * Send text message (with optional voice response)
   */
  const sendMessage = async (content: string, withVoice: boolean = false) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    // Exit conversational mode when user types
    setState(prev => ({ ...prev, isProcessing: true, isConversationalMode: false }))

    try {
      // Process message with LLM
      const context = getContext()
      const result = await realtimeAgent.processTextMessage(
        content.trim(),
        messages,
        context,
        withVoice
      )

      // Add assistant response to chat
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.responseText,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])

      // Play audio if generated
      if (result.responseAudioUri) {
        setState(prev => ({ ...prev, isSpeaking: true }))
        await realtimeAgent.playResponse(result.responseAudioUri)
        setState(prev => ({ ...prev, isSpeaking: false }))
      }
    } catch (error) {
      console.error('[AssistantContext] Error sending message:', error)

      // Add error message to chat
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t('assistant.errors.processingError'),
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }))
    }
  }

  /**
   * Start listening for voice input
   */
  const startListening = async () => {
    try {
      // Request permission if not granted
      const hasPermission = await requestMicrophonePermission()
      if (!hasPermission) {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: t('assistant.errors.noPermission'),
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMessage])
        return
      }

      // Stop any current speaking
      if (state.isSpeaking) {
        await realtimeAgent.stopSpeaking()
        setState(prev => ({ ...prev, isSpeaking: false }))
      }

      // Start recording and enter conversational mode
      setState(prev => ({ ...prev, isListening: true, isConversationalMode: true }))
      await realtimeAgent.startListening()
    } catch (error) {
      console.error('[AssistantContext] Error starting listening:', error)
      setState(prev => ({ ...prev, isListening: false, isConversationalMode: false }))

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t('assistant.errors.processingError'),
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  /**
   * Stop listening and process voice message
   */
  const stopListening = async () => {
    if (!state.isListening) return

    const isInConversationalMode = state.isConversationalMode

    setState(prev => ({ ...prev, isListening: false, isProcessing: true }))

    try {
      const context = getContext()

      // Stop recording and get transcription first (optimistic UI)
      const audioUri = await realtimeAgent.stopRecordingAndGetAudio()

      // Transcribe immediately and show to user
      // Pass last message as context for better accuracy
      const previousMessage = messages.length > 0 ? messages[messages.length - 1].content : ''
      const transcribePromise = realtimeAgent.transcribeAudio(
        audioUri,
        context.language === 'es' ? 'es' : 'en',
        previousMessage
      )

      // Show transcription as soon as available (don't wait for LLM)
      const transcribedText = await transcribePromise

      // Add user message to history (for both modes - needed for context in next turn)
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: transcribedText,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, userMessage])

      // Cleanup audio in background (don't block on this)
      realtimeAgent.cleanupAudioFile(audioUri).catch(console.error)

      // Track early TTS
      let firstSentenceTTS: Promise<string> | null = null
      let firstSentenceText = ''

      // Process with LLM with early TTS callback
      const responseText = await realtimeAgent.processWithLLM(
        transcribedText,
        messages,
        context,
        firstSentence => {
          // First complete sentence is ready - start TTS immediately!
          firstSentenceText = firstSentence
          firstSentenceTTS = realtimeAgent.textToSpeech(firstSentence, context.language)
        }
      )

      // Generate TTS
      let responseAudioUri: string

      if (firstSentenceTTS && firstSentenceText) {
        // We started early TTS - check if we need TTS for rest of text
        const remainingText = responseText.substring(firstSentenceText.length).trim()

        if (remainingText.length > 10) {
          // There's more text - generate second audio chunk
          const [audio1, audio2] = await Promise.all([
            firstSentenceTTS,
            realtimeAgent.textToSpeech(remainingText, context.language),
          ])

          // Store both audios for sequential playback
          responseAudioUri = JSON.stringify({ audio1, audio2, queue: true })
        } else {
          // Only one sentence - use early TTS
          responseAudioUri = await firstSentenceTTS
        }
      } else {
        // No early TTS (shouldn't happen but defensive)
        responseAudioUri = await realtimeAgent.textToSpeech(responseText, context.language)
      }

      // Add assistant response to history (for both modes - needed for context)
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])

      const result = { transcribedText, responseText, responseAudioUri }

      // Play response audio (waits until audio finishes)
      setState(prev => ({ ...prev, isProcessing: false, isSpeaking: true }))

      // Check if we have audio queue (multiple chunks from early TTS)
      try {
        const queueData = JSON.parse(result.responseAudioUri)
        if (queueData.queue && queueData.audio1 && queueData.audio2) {
          // Play first audio chunk
          await realtimeAgent.playResponse(queueData.audio1)
          // Play second audio chunk seamlessly
          await realtimeAgent.playResponse(queueData.audio2)
        } else {
          // Single audio
          await realtimeAgent.playResponse(result.responseAudioUri)
        }
      } catch {
        // Not JSON, single audio URI
        await realtimeAgent.playResponse(result.responseAudioUri)
      }

      // Audio finished playing, update state
      setState(prev => ({ ...prev, isSpeaking: false }))

      // Auto-listen again if in conversational mode
      if (isInConversationalMode) {
        // Small delay before starting to listen again (100ms for audio system cleanup)
        setTimeout(() => {
          startListening()
        }, 100)
      }
    } catch (error) {
      console.error('[AssistantContext] Error processing voice:', error)

      setState(prev => ({ ...prev, isProcessing: false, isConversationalMode: false }))

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t('assistant.errors.processingError'),
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  /**
   * Alias for stopListening (for backwards compatibility)
   */
  const sendVoiceMessage = stopListening

  /**
   * Cancel listening without processing
   */
  const cancelListening = () => {
    realtimeAgent.cancelRecording()
    setState(prev => ({ ...prev, isListening: false, isConversationalMode: false }))
  }

  /**
   * Stop speaking current audio
   */
  const stopSpeaking = () => {
    realtimeAgent.stopSpeaking()
    setState(prev => ({ ...prev, isSpeaking: false }))
  }

  const clearMessages = () => {
    setMessages([])
  }

  const value: AssistantContextType = {
    messages,
    state,
    openAssistant,
    closeAssistant,
    sendMessage,
    sendVoiceMessage,
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking,
    clearMessages,
  }

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

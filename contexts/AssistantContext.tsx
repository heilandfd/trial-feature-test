import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { Message, AssistantState } from '../types/assistant'
import { useI18n } from '../components/I18nProvider'

interface AssistantContextType {
  // State
  messages: Message[]
  state: AssistantState

  // Actions
  openAssistant: () => void
  closeAssistant: () => void
  sendMessage: (content: string) => Promise<void>
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
  const { t } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [state, setState] = useState<AssistantState>({
    isOpen: false,
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
  })

  const openAssistant = () => {
    setState(prev => ({ ...prev, isOpen: true }))
  }

  const closeAssistant = () => {
    setState(prev => ({ ...prev, isOpen: false }))
  }

  const sendMessage = async (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setState(prev => ({ ...prev, isProcessing: true }))

    try {
      // TODO: Replace with actual LLM/API call
      // Temporary echo response for development
      await new Promise(resolve => setTimeout(resolve, 1000))

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Echo: "${content}"`, // TODO: Replace with actual AI response
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
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

  const clearMessages = () => {
    setMessages([])
  }

  const value: AssistantContextType = {
    messages,
    state,
    openAssistant,
    closeAssistant,
    sendMessage,
    clearMessages,
  }

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

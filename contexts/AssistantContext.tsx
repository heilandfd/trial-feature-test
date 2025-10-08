import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { Message, AssistantState } from '../types/assistant'

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
  const [messages, setMessages] = useState<Message[]>([])
  const [state, setState] = useState<AssistantState>({
    isOpen: false,
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
  })

  const openAssistant = () => {
    // TODO: Open sheet dialog - implementation pending
    alert('TODO: Open sheet dialog')
    setState(prev => ({ ...prev, isOpen: true }))
  }

  const closeAssistant = () => {
    setState(prev => ({ ...prev, isOpen: false }))
  }

  const sendMessage = async (content: string) => {
    if (!content.trim()) return

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])

    // For now, echo response (will be replaced with intent routing + tools)
    setState(prev => ({ ...prev, isProcessing: true }))

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: `Echo: "${content}"`,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, assistantMessage])
    setState(prev => ({ ...prev, isProcessing: false }))
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

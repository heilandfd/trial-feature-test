/**
 * Assistant feature type definitions
 */

export type MessageRole = 'user' | 'assistant'

export type IntentType = 'report' | 'time' | 'chat'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  intent?: IntentType
}

export interface AssistantState {
  isOpen: boolean
  isListening: boolean
  isSpeaking: boolean
  isProcessing: boolean
}

export interface ToolResult {
  type: IntentType
  text: string
  data?: any
}

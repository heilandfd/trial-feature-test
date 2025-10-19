import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Keyboard } from 'react-native'
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetFooter,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAssistant } from '../../contexts/AssistantContext'
import { useI18n } from '../I18nProvider'
import type { Message } from '../../types/assistant'
import { AssistantTrigger } from './AssistantTrigger'
import { Colors } from '../../constants/Colors'

// Footer with internal state to prevent parent re-renders
interface InputFooterProps {
  isProcessing: boolean
  placeholder: string
  onSendMessage: (text: string) => Promise<void>
  bottomInset: number
  t: (key: string) => string
}

const InputFooter = React.memo<InputFooterProps>(
  ({ isProcessing, placeholder, onSendMessage, bottomInset, t }) => {
    const [text, setText] = React.useState('')

    const handleSend = useCallback(async () => {
      if (!text.trim() || isProcessing) return
      const message = text
      setText('')
      await onSendMessage(message)
    }, [text, isProcessing, onSendMessage])

    return (
      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: Math.max(bottomInset, 12),
            minHeight: INPUT_BAR_HEIGHT + Math.max(bottomInset, 12),
          },
        ]}
      >
        <BottomSheetTextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.light.onSurfaceLight}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          submitBehavior="submit"
          maxLength={MAX_MESSAGE_LENGTH}
          editable={!isProcessing}
          accessibilityLabel={placeholder}
          accessibilityHint={t('assistant.accessibility.inputHint')}
        />
        <TouchableOpacity
          onPress={handleSend}
          style={[styles.sendButton, (!text.trim() || isProcessing) && styles.sendButtonDisabled]}
          disabled={!text.trim() || isProcessing}
          accessibilityLabel={t('assistant.accessibility.sendButton')}
          accessibilityRole="button"
          accessibilityState={{ disabled: !text.trim() || isProcessing }}
        >
          <Ionicons
            name="send"
            size={20}
            color={
              text.trim() && !isProcessing ? Colors.light.onPrimary : Colors.light.onSurfaceLight
            }
          />
        </TouchableOpacity>
      </View>
    )
  }
)

InputFooter.displayName = 'InputFooter'

// Constants
const MAX_MESSAGE_LENGTH = 500
const SCROLL_BOTTOM_PADDING = 100
const AUTO_SCROLL_DELAY_MS = 100
const INPUT_BAR_HEIGHT = 56

// Component-specific colors for chat UI
const CHAT_COLORS = {
  // Message bubble specific colors
  userBubble: Colors.light.accent, // Blue for user messages
  assistantBubble: Colors.light.surfaceTertiary, // Light gray for assistant
  userTimestamp: '#DBEAFE', // Light blue for user message timestamps
  recording: Colors.light.error, // Red for recording state
} as const

interface MessageBubbleProps {
  message: Message
  locale: string
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, locale }) => {
  const isUser = message.role === 'user'

  return (
    <View style={[styles.messageBubbleContainer, isUser && styles.userMessageContainer]}>
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>
        <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
          {message.timestamp.toLocaleTimeString(locale === 'es' ? 'es-ES' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  )
}

export const AssistantBottomSheet: React.FC = () => {
  const {
    state,
    messages,
    closeAssistant,
    sendMessage,
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking,
    clearMessages,
  } = useAssistant()
  const { t, language } = useI18n()
  const insets = useSafeAreaInsets()
  const bottomSheetRef = useRef<BottomSheetModal>(null)
  const scrollViewRef = useRef<any>(null) // BottomSheetScrollView doesn't export ref type

  const snapPoints = useMemo(() => ['90%'], [])

  // Handle keyboard show/hide
  useEffect(() => {
    const keyboardWillShow = () => {
      // Force bottom sheet to expand when keyboard shows
      setTimeout(() => {
        bottomSheetRef.current?.snapToIndex(0)
      }, 50)
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', keyboardWillShow)

    return () => {
      showSubscription?.remove()
    }
  }, [])

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (text: string) => {
      try {
        await sendMessage(text)
      } catch (error) {
        console.error('[AssistantBottomSheet] Error sending message:', error)
      }
    },
    [sendMessage]
  )

  // Handle voice trigger press
  const handleVoiceTriggerPress = useCallback(() => {
    if (state.isListening) {
      // If currently listening → stop and process
      stopListening()
    } else if (state.isSpeaking) {
      // If currently speaking → stop audio
      stopSpeaking()
    } else if (state.isConversationalMode) {
      // If in conversational mode but idle → exit conversational mode
      cancelListening()
    } else {
      // If not in conversational mode → start conversational mode
      startListening()
    }
  }, [
    state.isListening,
    state.isSpeaking,
    state.isConversationalMode,
    startListening,
    stopListening,
    stopSpeaking,
    cancelListening,
  ])

  // Backdrop component
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  )

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter
        {...props}
        bottomInset={insets.bottom}
        style={{ backgroundColor: Colors.light.surface }}
      >
        <InputFooter
          isProcessing={state.isProcessing}
          placeholder={t('assistant.placeholder')}
          onSendMessage={handleSendMessage}
          bottomInset={insets.bottom}
          t={t}
        />
      </BottomSheetFooter>
    ),
    [insets.bottom, state.isProcessing, handleSendMessage, t]
  )

  // Open/close modal based on state
  useEffect(() => {
    if (state.isOpen) {
      bottomSheetRef.current?.present()
    }
  }, [state.isOpen])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, AUTO_SCROLL_DELAY_MS)
    }
  }, [messages])

  const handleDismiss = () => {
    // Stop any ongoing voice operations when closing
    if (state.isListening) {
      cancelListening()
    }
    if (state.isSpeaking) {
      stopSpeaking()
    }
    if (state.isConversationalMode) {
      cancelListening()
    }

    closeAssistant()
    clearMessages()
  }

  const handleClose = () => {
    bottomSheetRef.current?.dismiss()
  }

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustPan"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoCircle}>
            <Ionicons name="chatbubbles" size={20} color={Colors.light.onPrimary} />
          </View>
          <Text style={styles.headerTitle}>{t('assistant.emptyStateTitle')}</Text>
        </View>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeButton}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
          accessibilityHint={t('assistant.accessibility.closeButton')}
        >
          <Ionicons name="close" size={24} color={Colors.light.onSurfaceSecondary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <BottomSheetScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={[
          styles.messagesContent,
          {
            paddingBottom: SCROLL_BOTTOM_PADDING + INPUT_BAR_HEIGHT + Math.max(insets.bottom, 12),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 || state.isConversationalMode ? (
          <View style={styles.emptyState}>
            <View style={styles.voiceTriggerContainer}>
              <AssistantTrigger
                onPress={handleVoiceTriggerPress}
                isActive={state.isListening || state.isSpeaking}
                isListening={state.isListening}
                size={80}
              />
            </View>
            <Text style={styles.emptyStateTitle}>
              {state.isListening
                ? t('assistant.listening')
                : state.isProcessing
                  ? t('assistant.processing')
                  : state.isSpeaking
                    ? t('assistant.speaking')
                    : state.isConversationalMode
                      ? t('assistant.waitingForYou')
                      : t('assistant.emptyStateSubtitle')}
            </Text>
            {/* Show last message in conversational mode for context */}
            {state.isConversationalMode && messages.length > 0 && (
              <Text style={styles.lastMessagePreview} numberOfLines={4}>
                {messages[messages.length - 1].content}
              </Text>
            )}
            <Text style={styles.emptyStateText}>
              {state.isListening
                ? t('assistant.tapToStopRecording')
                : state.isProcessing
                  ? ''
                  : state.isSpeaking
                    ? t('assistant.tapToStopSpeaking')
                    : state.isConversationalMode
                      ? t('assistant.tapToEndConversation')
                      : t('assistant.tapToSpeak')}
            </Text>
            {state.isProcessing && (
              <View style={styles.typingIndicator}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, styles.typingDot2]} />
                <View style={[styles.typingDot, styles.typingDot3]} />
              </View>
            )}
          </View>
        ) : (
          messages.map(message => (
            <MessageBubble key={message.id} message={message} locale={language} />
          ))
        )}
        {state.isProcessing && !state.isConversationalMode && (
          <View style={styles.typingIndicator}>
            <View style={styles.typingDot} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: Colors.light.indicator,
    width: 40,
    height: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.outlineVariant,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.onSurface,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
    maxHeight: '100%',
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  voiceTriggerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.onSurfaceTertiary,
    marginTop: 16,
    marginBottom: 8,
  },
  lastMessagePreview: {
    fontSize: 14,
    color: Colors.light.onSurfaceSecondary,
    marginTop: 8,
    marginHorizontal: 32,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
    lineHeight: 20,
    maxHeight: 60,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.light.onSurfaceSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  messageBubbleContainer: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: CHAT_COLORS.userBubble,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: CHAT_COLORS.assistantBubble,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  userText: {
    color: Colors.light.onAccent,
  },
  assistantText: {
    color: Colors.light.onSurface,
  },
  timestamp: {
    fontSize: 11,
    color: Colors.light.onSurfaceSecondary,
  },
  userTimestamp: {
    color: CHAT_COLORS.userTimestamp,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CHAT_COLORS.assistantBubble,
    borderRadius: 16,
    maxWidth: '80%',
    borderBottomLeftRadius: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.onSurfaceLight,
  },
  typingDot2: {
    opacity: 0.7,
  },
  typingDot3: {
    opacity: 0.4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.outlineVariant,
    backgroundColor: Colors.light.surface,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: Colors.light.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: Colors.light.onSurface,
    borderWidth: 1,
    borderColor: Colors.light.outline,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CHAT_COLORS.userBubble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.light.state.disabled,
  },
})

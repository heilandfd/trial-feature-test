import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Colors } from '../constants/Colors'

// Error boundary specific colors
const ERROR_COLORS = {
  background: '#FEF2F2', // Light red background
  border: '#FECACA', // Light red border
  darkText: '#7F1D1D', // Dark red text
} as const

interface ErrorDisplayProps {
  error: string
  onRetry?: () => void
  onDismiss?: () => void
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry, onDismiss }) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTitle}>Algo salió mal</Text>
    <Text style={styles.errorMessage}>{error}</Text>
    <View style={styles.errorActions}>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      )}
      {onDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissButtonText}>Cerrar</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
)

interface LoadingDisplayProps {
  message?: string
}

export const LoadingDisplay: React.FC<LoadingDisplayProps> = ({ message = 'Cargando...' }) => (
  <View style={styles.loadingContainer}>
    <Text style={styles.loadingText}>{message}</Text>
  </View>
)

const styles = StyleSheet.create({
  errorContainer: {
    backgroundColor: ERROR_COLORS.background,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: ERROR_COLORS.border,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.error,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: ERROR_COLORS.darkText,
    lineHeight: 20,
    marginBottom: 16,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: Colors.light.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.light.onError,
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.error,
  },
  dismissButtonText: {
    color: Colors.light.error,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.onSurfaceSecondary,
  },
})

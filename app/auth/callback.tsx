import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { supabase } from '../../lib/supabase'
import ErrorModal from '../../components/ErrorModal'
import { Colors } from '../../constants/Colors'

export default function AuthCallbackScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth error:', error)
          setError('Error al validar la sesión')
          setShowErrorModal(true)
          return
        }

        if (data.session) {
          router.replace('/dashboard')
        } else {
          setError('No se pudo validar la sesión')
          setShowErrorModal(true)
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        setError('Error inesperado')
        setShowErrorModal(true)
      } finally {
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [router])

  const handleRetry = () => {
    setShowErrorModal(false)
    router.replace('/login')
  }

  const handleCloseModal = () => {
    setShowErrorModal(false)
    router.replace('/login')
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={Colors.light.primaryDark} />
          <Text style={styles.loadingText}>Validando sesión...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ErrorModal
        visible={showErrorModal}
        title="Error de autenticación"
        message={
          error ||
          'Ocurrió un error al validar tu sesión. Por favor, intenta iniciar sesión nuevamente.'
        }
        onRetry={handleRetry}
        onClose={handleCloseModal}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.surface,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.onSurfaceSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.light.onSurfaceTertiary,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.light.onSurfaceSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
})

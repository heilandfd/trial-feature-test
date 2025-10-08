import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native'
import { useAuth } from '../components/AuthProvider'
import { useAto } from '../contexts/AtoContext'
import { DashboardHeader } from '../components/DashboardHeader'
import { UserStatusSection } from '../components/UserStatusSection'
import { RemindersSection } from '../components/RemindersSection'
import { BottomNavigation } from '../components/BottomNavigation'
import { ErrorDisplay, LoadingDisplay } from '../components/ErrorBoundary'
import { useI18n } from '../components/I18nProvider'

export default function DashboardScreen() {
  const router = useRouter()
  const { user, session, loading: authLoading } = useAuth()
  const { currentManager, initializeManagerAndUsers, loading, error } = useAto()
  const { t } = useI18n()
  const [initializing, setInitializing] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])

  // Initialize manager and user data when authenticated
  useEffect(() => {
    const initializeData = async () => {
      if (!user || !session?.access_token) return

      try {
        setInitializing(true)
        await initializeManagerAndUsers(user.id, session.access_token)
      } catch (err) {
        console.error('Error initializing data:', err)
      } finally {
        setInitializing(false)
      }
    }

    if (user && session && !currentManager && !loading) {
      initializeData()
    }
  }, [user, session, currentManager, loading, initializeManagerAndUsers])

  if (authLoading || initializing || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingDisplay message={t('dashboard.loadingDashboard')} />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorDisplay
          error={error}
          onRetry={() => {
            setInitializing(true)
            if (user && session?.access_token) {
              initializeManagerAndUsers(user.id, session.access_token)
            }
          }}
          onDismiss={() => {}}
        />
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <DashboardHeader />
          <UserStatusSection />
          <RemindersSection />
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
      <BottomNavigation />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  bottomSpacer: {
    height: 20,
  },
})

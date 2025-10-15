import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import * as Linking from 'expo-linking'
import * as QueryParams from 'expo-auth-session/build/QueryParams'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DevConfig } from '../lib/dev-config'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  reloadSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * Load store testing session from AsyncStorage
   */
  const loadStoreTestingSession = async (): Promise<boolean> => {
    try {
      const userData = await AsyncStorage.getItem(DevConfig.storageKeys.storeTestingUser)
      if (userData) {
        const mockUser = JSON.parse(userData) as User
        setUser(mockUser)
        setSession(DevConfig.createMockSession(mockUser))
        return true
      }
    } catch (error) {
      console.error('Error loading store testing session:', error)
    }
    return false
  }

  const createSessionFromUrl = async (url: string) => {
    try {
      const { params } = QueryParams.getQueryParams(url)
      const { access_token, refresh_token } = params

      if (!access_token) return

      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })

      if (error) throw error
      return data.session
    } catch (error) {
      console.error('Error creating session from URL:', error)
      return null
    }
  }

  const signOut = async () => {
    try {
      // Clear store testing data if present
      await AsyncStorage.removeItem(DevConfig.storageKeys.storeTestingUser)

      // Sign out from Supabase
      await supabase.auth.signOut()

      // Clear local state
      setUser(null)
      setSession(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const reloadSession = async () => {
    try {
      // Check for store testing session first
      const loaded = await loadStoreTestingSession()
      if (loaded) return

      // Check Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
    } catch (error) {
      console.error('Error reloading session:', error)
    }
  }

  useEffect(() => {
    const initializeAuth = async () => {
      // Check for store testing mode first
      const loaded = await loadStoreTestingSession()
      if (loaded) {
        setLoading(false)
        return
      }

      // Get initial session from Supabase
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Don't override store testing mode
      const storeTestingData = await AsyncStorage.getItem(DevConfig.storageKeys.storeTestingUser)
      if (!storeTestingData) {
        setSession(session)
        setUser(session?.user ?? null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Handle deep linking for magic links
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      if (url.includes('atoapp://auth/callback')) {
        createSessionFromUrl(url)
      }
    }

    // Handle initial URL if app was opened from a link
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink(url)
      }
    })

    // Listen for URL changes
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url)
    })

    return () => subscription?.remove()
  }, [])

  const value = {
    user,
    session,
    loading,
    signOut,
    reloadSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

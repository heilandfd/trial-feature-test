import React, { createContext, useContext, useEffect, useState } from 'react'
import { atoApi, AtoManager, AtoUser, UserReport } from '../lib/ato-api'
import { DevConfig } from '../lib/dev-config'

interface AtoContextType {
  // Manager data
  currentManager: AtoManager | null
  setCurrentManager: (manager: AtoManager | null) => void

  // User data
  selectedUser: AtoUser | null
  setSelectedUser: (user: AtoUser | null) => void
  managedUsers: AtoUser[]
  setManagedUsers: (users: AtoUser[]) => void

  // User report data
  userReport: UserReport | null
  setUserReport: (report: UserReport | null) => void

  // Loading states
  loading: boolean
  setLoading: (loading: boolean) => void

  // Error handling
  error: string | null
  setError: (error: string | null) => void

  // Helper functions
  refreshUserReport: () => Promise<void>
  initializeManagerAndUsers: (supabaseUserId: string, accessToken: string) => Promise<void>
  getGreeting: () => string
  getUserStatusMessage: () => string
}

const AtoContext = createContext<AtoContextType | undefined>(undefined)

export const useAto = () => {
  const context = useContext(AtoContext)
  if (!context) {
    throw new Error('useAto must be used within an AtoProvider')
  }
  return context
}

export const AtoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentManager, setCurrentManager] = useState<AtoManager | null>(null)
  const [selectedUser, setSelectedUser] = useState<AtoUser | null>(null)
  const [managedUsers, setManagedUsers] = useState<AtoUser[]>([])
  const [userReport, setUserReport] = useState<UserReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Initializes manager and user data using Supabase authentication
   * @param supabaseUserId - The Supabase user ID (matches manager ID)
   * @param accessToken - The access token for API authentication
   */
  const initializeManagerAndUsers = async (supabaseUserId: string, accessToken: string) => {
    try {
      setLoading(true)
      setError(null)

      // Use mock data for test manager ID to avoid API calls
      if (DevConfig.isTestManager(supabaseUserId)) {
        setCurrentManager(DevConfig.createMockManager(supabaseUserId))
        setSelectedUser(null)
        setManagedUsers([])
        setLoading(false)
        return
      }

      // Set the API token
      await atoApi.setAuthToken(accessToken)

      // Get manager by ID (manager ID matches Supabase user ID)
      const manager = await atoApi.getManagerById(supabaseUserId)
      setCurrentManager(manager)

      // TODO: Implement API endpoint to fetch users managed by this manager
      // For now, initialize with empty state - users must be loaded through proper API
      setSelectedUser(null)
      setManagedUsers([])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error initializing data'
      setError(errorMessage)
      console.error('Error in initializeManagerAndUsers:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshUserReport = async () => {
    if (!selectedUser) return

    try {
      setLoading(true)
      setError(null)

      // Mock user report for development
      const mockReport: UserReport = {
        user_id: selectedUser.id,
        report_generated_at: new Date().toISOString(),
        summary: {
          total_contacts: 8,
          total_reminders: 12,
          active_reminders: 3,
          completed_reminders: 9,
        },
        recent_activity: [
          {
            type: 'reminder_completed',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            description: 'Completó recordatorio: Tomar medicamento',
          },
        ],
        upcoming_reminders: [
          {
            id: 'reminder-1',
            task: 'Poner agua para el mate',
            scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
        ],
      }

      setUserReport(mockReport)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error loading user report'
      setError(errorMessage)
      console.error('Error fetching user report:', err)
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = (): string => {
    const now = new Date()
    const hour = now.getHours()

    if (hour < 12) {
      return '¡Buenos días'
    } else if (hour < 18) {
      return '¡Buenas tardes'
    } else {
      return '¡Buenas noches'
    }
  }

  const getUserStatusMessage = (): string => {
    if (!selectedUser) return 'No hay usuario seleccionado'
    if (!userReport) return 'Cargando estado...'

    const hasRecentActivity = userReport.recent_activity.length > 0
    const userName = selectedUser.nickname || selectedUser.name

    if (hasRecentActivity) {
      const latestActivity = userReport.recent_activity[0]
      const activityDate = new Date(latestActivity.timestamp)
      const today = new Date()
      const isToday = activityDate.toDateString() === today.toDateString()

      if (isToday) {
        return `${userName} tiene actividad reciente`
      } else {
        return `${userName} última actividad: ${activityDate.toLocaleDateString()}`
      }
    } else {
      return `${userName} sin novedades recientes`
    }
  }

  // Auto-refresh user report when selected user changes
  useEffect(() => {
    if (selectedUser) {
      refreshUserReport()
    } else {
      setUserReport(null)
    }
  }, [selectedUser])

  // Set up periodic refresh of user report (every 5 minutes)
  useEffect(() => {
    if (!selectedUser) return

    const interval = setInterval(
      () => {
        refreshUserReport()
      },
      5 * 60 * 1000
    ) // 5 minutes

    return () => clearInterval(interval)
  }, [selectedUser])

  const value: AtoContextType = {
    currentManager,
    setCurrentManager,
    selectedUser,
    setSelectedUser,
    managedUsers,
    setManagedUsers,
    userReport,
    setUserReport,
    loading,
    setLoading,
    error,
    setError,
    refreshUserReport,
    initializeManagerAndUsers,
    getGreeting,
    getUserStatusMessage,
  }

  return <AtoContext.Provider value={value}>{children}</AtoContext.Provider>
}

import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native'
import { useAto } from '../contexts/AtoContext'
import { Reminder } from '../lib/ato-api'
import { CreateReminderModal } from './CreateReminderModal'
import { useI18n } from './I18nProvider'
import { formatRelativeDate } from '../lib/i18n'
import { Colors } from '../constants/Colors'

// Reminder-specific colors for status badges
const REMINDER_COLORS = {
  warningBg: '#FEF3C7', // Light yellow background for pending reminders
  warningText: '#92400E', // Dark brown text for warnings
} as const

interface ReminderItemProps {
  reminder: Reminder
  onUpdate: () => void
}

const ReminderItem: React.FC<ReminderItemProps> = ({ reminder, onUpdate }) => {
  const { t } = useI18n()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return Colors.light.warning
      case 'SENT':
        return Colors.light.accent
      case 'COMPLETED':
        return Colors.light.success
      case 'FAILED':
        return Colors.light.error
      default:
        return Colors.light.onSurfaceSecondary
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return t('reminders.status.pending')
      case 'SENT':
        return t('reminders.status.sent')
      case 'COMPLETED':
        return t('reminders.status.completed')
      case 'FAILED':
        return t('reminders.status.failed')
      default:
        return t('reminders.status.unknown')
    }
  }

  return (
    <View style={styles.reminderItem}>
      <View style={styles.reminderContent}>
        <Text style={styles.reminderTime}>
          {formatRelativeDate(new Date(reminder.scheduled_for))}
        </Text>
        <Text style={styles.reminderTask}>{reminder.task}</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(reminder.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(reminder.status) }]}>
            {getStatusText(reminder.status)}
          </Text>
        </View>
      </View>
    </View>
  )
}

export const RemindersSection: React.FC = () => {
  const { selectedUser, currentManager, setError } = useAto()
  const { t } = useI18n()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadReminders = useCallback(async () => {
    if (!selectedUser || !currentManager) return

    try {
      setLoading(true)

      // Mock reminders data for development
      const mockReminders: Reminder[] = [
        {
          id: 'reminder-1',
          user_id: selectedUser.id,
          task: t('reminders.sampleTasks.putWaterForMate'),
          scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
          rrule: 'FREQ=DAILY;INTERVAL=1',
          status: 'PENDING',
          last_sent_at: null,
          attempts: 0,
          manager_id: currentManager.id,
        },
        {
          id: 'reminder-2',
          user_id: selectedUser.id,
          task: t('reminders.sampleTasks.takeMedicine'),
          scheduled_for: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
          rrule: 'FREQ=DAILY;INTERVAL=1',
          status: 'PENDING',
          last_sent_at: null,
          attempts: 0,
          manager_id: currentManager.id,
        },
      ]

      setReminders(mockReminders)
    } catch (error) {
      console.error('Error loading reminders:', error)
      setError(error instanceof Error ? error.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [selectedUser, currentManager, setError, t])

  const handleCreateReminder = async (reminderData: Partial<Reminder>) => {
    if (!selectedUser || !currentManager) return

    try {
      // Mock creating a reminder
      const newReminder: Reminder = {
        id: `reminder-${Date.now()}`,
        user_id: selectedUser.id,
        manager_id: currentManager.id,
        task: reminderData.task || '',
        scheduled_for: reminderData.scheduled_for || new Date().toISOString(),
        rrule: reminderData.rrule || '',
        status: 'PENDING',
        last_sent_at: null,
        attempts: 0,
      }

      // Add to current reminders list
      setReminders(prev => [...prev, newReminder])
      setShowCreateModal(false)

      Alert.alert(t('common.success'), t('reminders.createSuccess'))
    } catch (error) {
      console.error('Error creating reminder:', error)
      Alert.alert(t('common.error'), t('reminders.createError'))
    }
  }

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  const handleSeeAll = () => {
    // TODO: Navigate to full reminders screen
    console.log('Navigate to full reminders screen')
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('reminders.title')}</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
          disabled={!selectedUser || !currentManager}
        >
          <Text style={styles.createButtonIcon}>+</Text>
          <Text style={styles.createButtonText}>{t('common.create')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        {t('reminders.subtitle', {
          userName: selectedUser?.nickname || selectedUser?.name || 'el usuario',
        })}
      </Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('reminders.loading')}</Text>
        </View>
      ) : reminders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('reminders.empty')}</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={reminders.slice(0, 3)}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <ReminderItem reminder={item} onUpdate={loadReminders} />}
            scrollEnabled={false}
            style={styles.remindersList}
          />

          {reminders.length > 3 && (
            <TouchableOpacity style={styles.seeAllButton} onPress={handleSeeAll}>
              <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
              <Text style={styles.seeAllArrow}>→</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <CreateReminderModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateReminder}
        userName={selectedUser?.nickname || selectedUser?.name || ''}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 120,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.onSurface,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.onSurface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonIcon: {
    color: Colors.light.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  createButtonText: {
    color: Colors.light.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.onSurfaceSecondary,
    paddingHorizontal: 20,
    marginBottom: 16,
    lineHeight: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.onSurfaceSecondary,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.onSurfaceSecondary,
    textAlign: 'center',
  },
  remindersList: {
    paddingHorizontal: 20,
  },
  reminderItem: {
    backgroundColor: REMINDER_COLORS.warningBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.light.warning,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTime: {
    fontSize: 14,
    color: REMINDER_COLORS.warningText,
    marginBottom: 8,
    fontWeight: '500',
  },
  reminderTask: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.accent,
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.warning,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.outline,
  },
  seeAllText: {
    fontSize: 16,
    color: Colors.light.accent,
    fontWeight: '600',
    marginRight: 8,
  },
  seeAllArrow: {
    fontSize: 16,
    color: Colors.light.accent,
    fontWeight: '600',
  },
})

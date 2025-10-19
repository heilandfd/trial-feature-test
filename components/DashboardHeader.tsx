import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAto } from '../contexts/AtoContext'
import { useI18n } from './I18nProvider'

// Dashboard header specific gradient colors
const HEADER_GRADIENT = ['#87CEEB', '#4FB3D9', '#1E90FF'] as const
const HEADER_COLORS = {
  greetingText: '#1E3A8A', // Dark blue for greeting
  subtitleText: '#64748B', // Slate for subtitle
} as const

export const DashboardHeader: React.FC = () => {
  const { currentManager } = useAto()
  const { t } = useI18n()

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return t('dashboard.greeting.morning')
    if (hour < 18) return t('dashboard.greeting.afternoon')
    if (hour < 21) return t('dashboard.greeting.evening')
    return t('dashboard.greeting.night')
  }

  const managerName = currentManager?.nickname || currentManager?.name || 'gaspi'

  return (
    <LinearGradient colors={HEADER_GRADIENT} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.greeting}>
          {getGreeting()}, {managerName}!
        </Text>
        <Text style={styles.subtitle}>{t('dashboard.subtitle')}</Text>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  content: {
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 32,
    fontWeight: '800',
    color: HEADER_COLORS.greetingText,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: HEADER_COLORS.subtitleText,
    opacity: 0.8,
  },
})

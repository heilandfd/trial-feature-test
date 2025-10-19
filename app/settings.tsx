import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native'
import { BottomNavigation } from '../components/BottomNavigation'
import { useAuth } from '../components/AuthProvider'
import { useI18n } from '../components/I18nProvider'
import { Colors } from '../constants/Colors'

export default function SettingsScreen() {
  const { signOut } = useAuth()
  const { t, language, setLanguage } = useI18n()
  const [changingLanguage, setChangingLanguage] = useState(false)

  const handleLanguageChange = async (newLanguage: string) => {
    if (newLanguage === language) return

    try {
      setChangingLanguage(true)
      await setLanguage(newLanguage)
    } catch {
      Alert.alert(t('common.error'), 'Failed to change language')
    } finally {
      setChangingLanguage(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres cerrar sesión?', [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: signOut,
      },
    ])
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text style={styles.title}>{t('settings.title')}</Text>
          <Text style={styles.subtitle}>Configura las preferencias de la aplicación</Text>

          {/* Language Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
            <View style={styles.languageOptions}>
              <TouchableOpacity
                style={[styles.languageOption, language === 'es' && styles.languageOptionActive]}
                onPress={() => handleLanguageChange('es')}
                disabled={changingLanguage}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    language === 'es' && styles.languageOptionTextActive,
                  ]}
                >
                  {t('settings.languages.spanish')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.languageOption, language === 'en' && styles.languageOptionActive]}
                onPress={() => handleLanguageChange('en')}
                disabled={changingLanguage}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    language === 'en' && styles.languageOptionTextActive,
                  ]}
                >
                  {t('settings.languages.english')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
      <BottomNavigation />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.surfaceVariant,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.light.onSurface,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.onSurfaceSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  logoutButton: {
    backgroundColor: Colors.light.error,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: Colors.light.onError,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.onSurface,
    marginBottom: 16,
  },
  languageOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  languageOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.light.outline,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
  },
  languageOptionActive: {
    borderColor: Colors.light.accent,
    backgroundColor: Colors.light.state.activeBackground,
  },
  languageOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.onSurfaceSecondary,
  },
  languageOptionTextActive: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
})

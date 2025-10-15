import AtoLogo from '../components/AtoLogo'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Clipboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { useI18n } from '../components/I18nProvider'
import ErrorModal from '../components/ErrorModal'
import ContactPopup from '../components/ContactPopup'
import { DevConfig } from '../lib/dev-config'

export default function LoginScreen() {
  const router = useRouter()
  const { user, loading: authLoading, reloadSession } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [otp, setOtp] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [showContactPopup, setShowContactPopup] = useState(false)

  useEffect(() => {
    if (user && !authLoading) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const handleOpenEmail = async () => {
    try {
      const emailApps = [
        { name: 'Gmail', url: 'googlegmail://' },
        { name: 'Outlook', url: 'ms-outlook://' },
        { name: 'Yahoo Mail', url: 'ymail://' },
        { name: 'Apple Mail', url: 'message://' },
      ]

      for (const app of emailApps) {
        const canOpen = await Linking.canOpenURL(app.url)
        if (canOpen) {
          await Linking.openURL(app.url)
          return
        }
      }

      const defaultMailUrl = Platform.OS === 'ios' ? 'message://' : 'mailto:'
      await Linking.openURL(defaultMailUrl)
    } catch {
      setError(t('auth.errors.couldNotOpenEmail'))
      setShowErrorModal(true)
    }
  }

  const handlePasteOtp = async () => {
    try {
      const clipboardContent = await Clipboard.getString()
      if (clipboardContent && clipboardContent.length === 6 && /^\d+$/.test(clipboardContent)) {
        setOtp(clipboardContent)
        // Auto-verify after pasting
        setTimeout(() => {
          handleVerifyOtp(clipboardContent)
        }, 100)
      } else {
        setError(t('auth.errors.invalidCodeInClipboard'))
        setShowErrorModal(true)
      }
    } catch {
      setError(t('auth.errors.couldNotAccessClipboard'))
      setShowErrorModal(true)
    }
  }

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const otpCode = codeToVerify || otp

    if (!otpCode || otpCode.length !== 6) {
      setError(t('auth.errors.invalidCode'))
      setShowErrorModal(true)
      return
    }

    setVerifyingOtp(true)

    // Store testing bypass: accept test token for test email
    if (DevConfig.isTestEmail(email) && DevConfig.isTestOtp(otpCode)) {
      setTimeout(async () => {
        // Create a mock session for store testing
        const mockUser = DevConfig.createMockUser()

        // Store the mock user data for store testing
        await AsyncStorage.setItem(DevConfig.storageKeys.storeTestingUser, JSON.stringify(mockUser))

        // Reload session to pick up the mock user
        await reloadSession()

        setVerifyingOtp(false)
        router.replace('/dashboard')
      }, 1000) // Simulate verification delay
      return
    }

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      })

      if (error) {
        setError(t('auth.errors.verificationError'))
        setShowErrorModal(true)
      } else {
        router.replace('/dashboard')
      }
    } catch {
      setError(t('auth.errors.verificationError'))
      setShowErrorModal(true)
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleOtpChange = (value: string) => {
    setOtp(value)
    // Auto-verify when 6 digits are entered
    if (value.length === 6 && /^\d{6}$/.test(value)) {
      setTimeout(() => {
        handleVerifyOtp(value)
      }, 300) // Small delay to let user see the complete input
    }
  }

  const handleSendMagicLink = async () => {
    if (!email) {
      setError(t('auth.errors.emailNotProvided'))
      setShowErrorModal(true)
      return
    }

    // Store testing bypass: skip server request for test email
    if (DevConfig.isTestEmail(email)) {
      setLoading(true)
      setTimeout(() => {
        setEmailSent(true)
        setLoading(false)
      }, 1000) // Simulate loading delay for realistic UX
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'atoapp://auth/callback',
        },
      })

      if (error) {
        setError(t('auth.errors.somethingWentWrong'))
        setShowErrorModal(true)
      } else {
        setEmailSent(true)
      }
    } catch {
      setError(t('auth.errors.somethingWentWrong'))
      setShowErrorModal(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <AtoLogo width={200} height={92} color="#FFFFFF" />
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {!emailSent ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>{t('auth.email')}</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t('auth.emailPlaceholder')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholderTextColor="#9CA3AF"
                    textContentType="emailAddress"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSendMagicLink}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#FF6D00', '#FF6D00']}
                    style={styles.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>{t('auth.sendMagicLink')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.subtitle}>{t('auth.magicLinkDescription')}</Text>
              </>
            ) : (
              <>
                <View style={styles.emailSentContainer}>
                  <Text style={styles.emailSentText}>
                    {t('auth.emailSentTo')} <Text style={styles.emailAddress}>{email}</Text>
                  </Text>
                </View>

                <View style={styles.otpContainer}>
                  <View style={styles.otpInputContainer}>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.otpInput}
                        value={otp}
                        onChangeText={handleOtpChange}
                        placeholder={t('auth.verificationCodePlaceholder')}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoComplete="one-time-code"
                        textContentType="oneTimeCode"
                        placeholderTextColor="#9CA3AF"
                      />
                      <TouchableOpacity style={styles.pasteButton} onPress={handlePasteOtp}>
                        <Text style={styles.pasteButtonText}>{t('auth.paste')}</Text>
                      </TouchableOpacity>
                    </View>
                    {verifyingOtp && (
                      <ActivityIndicator color="#00D4FF" size="small" style={styles.inputLoader} />
                    )}
                  </View>

                  <Text style={styles.emailSentDescription}>{t('auth.emailSentDescription')}</Text>

                  {otp.length > 0 && otp.length < 6 && !verifyingOtp && (
                    <TouchableOpacity
                      style={[styles.verifyButton, styles.buttonDisabled]}
                      disabled={true}
                    >
                      <LinearGradient
                        colors={['#D1D5DB', '#9CA3AF']}
                        style={styles.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={[styles.buttonText, { color: '#6B7280' }]}>
                          {6 - otp.length} {t('auth.digitsRemaining')}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {verifyingOtp && (
                    <TouchableOpacity
                      style={[styles.verifyButton, styles.buttonDisabled]}
                      disabled={true}
                    >
                      <LinearGradient
                        colors={['#00D4FF', '#00A8E8']}
                        style={styles.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <ActivityIndicator color="#fff" size="small" />
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.orDivider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.orText}>o</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.button} onPress={handleOpenEmail}>
                  <LinearGradient
                    colors={['#FF6D00', '#FF6D00']}
                    style={styles.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.buttonText}>{t('auth.openEmail')}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.backButton} onPress={() => setEmailSent(false)}>
                  <Text style={styles.backButtonText}>{t('auth.goBack')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Footer - only show create account when not in verification mode */}
          {!emailSent && (
            <TouchableOpacity
              style={styles.footer}
              activeOpacity={0.7}
              onPress={() => setShowContactPopup(true)}
            >
              <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
              <Text style={styles.footerLink}>{t('auth.createAccount')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <ErrorModal
        visible={showErrorModal}
        title={t('common.error')}
        message={error || t('errors.unexpected')}
        onRetry={() => setShowErrorModal(false)}
        onClose={() => setShowErrorModal(false)}
      />

      <ContactPopup visible={showContactPopup} onClose={() => setShowContactPopup(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3CCEF5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoImage: {
    width: 120,
    height: 60,
  },
  formContainer: {
    marginBottom: 60,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'left',
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#F0F9FF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    letterSpacing: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  button: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    marginTop: 4,
    shadowColor: '#00D4FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  gradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  footerLink: {
    fontSize: 15,
    color: '#FF6D00',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  emailSentContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  emailSentText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  emailAddress: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emailSentDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  otpContainer: {
    marginBottom: 24,
  },
  otpLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  otpInputContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  otpInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#F0F9FF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 80,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    textAlign: 'left',
    letterSpacing: 6,
    fontWeight: '600',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pasteButton: {
    position: 'absolute',
    right: 8,
    backgroundColor: '#FF6D00',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pasteButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  verifyButton: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#00D4FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
  inputLoader: {
    marginLeft: 8,
  },
})

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import 'react-native-reanimated'

import { useColorScheme } from '@/hooks/useColorScheme'
import { AuthProvider } from '@/components/AuthProvider'
import { AuthGuard } from '@/components/AuthGuard'
import { AtoProvider } from '@/contexts/AtoContext'
import { I18nProvider } from '@/components/I18nProvider'
import { AssistantProvider } from '@/contexts/AssistantContext'
import { AssistantBottomSheet } from '@/components/assistant'

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })

  if (!loaded) {
    // Async font loading only occurs in development.
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <I18nProvider>
          <AuthProvider>
            <AtoProvider>
              <AssistantProvider>
                <AuthGuard>
                  <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <Stack>
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen name="login" options={{ headerShown: false }} />
                      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
                      <Stack.Screen name="contacts" options={{ headerShown: false }} />
                      <Stack.Screen name="profile" options={{ headerShown: false }} />
                      <Stack.Screen name="settings" options={{ headerShown: false }} />
                      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                      <Stack.Screen name="+not-found" />
                    </Stack>
                    <AssistantBottomSheet />
                    <StatusBar style="auto" />
                  </ThemeProvider>
                </AuthGuard>
              </AssistantProvider>
            </AtoProvider>
          </AuthProvider>
        </I18nProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  )
}

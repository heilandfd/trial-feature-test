import React from 'react'
import { Image } from 'expo-image'
import { StyleSheet, TouchableOpacity } from 'react-native'

import { HelloWave } from '@/components/HelloWave'
import ParallaxScrollView from '@/components/ParallaxScrollView'
import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import { useAuth } from '@/components/AuthProvider'
import { Colors } from '@/constants/Colors'

// Home screen specific colors
const HOME_COLORS = {
  headerGradient: {
    light: '#A1CEDC',
    dark: '#1D3D47',
  },
} as const

export default function HomeScreen() {
  const { user, signOut } = useAuth()

  return (
    <ParallaxScrollView
      headerBackgroundColor={HOME_COLORS.headerGradient}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome to Ato!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Authenticated User</ThemedText>
        <ThemedText>email: {user?.email}</ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
          <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ParallaxScrollView>
  )
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  signOutButton: {
    backgroundColor: Colors.light.error,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  signOutText: {
    color: Colors.light.onError,
    fontWeight: 'bold',
  },
})

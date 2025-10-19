import React from 'react'
import { View, Text, StyleSheet, SafeAreaView } from 'react-native'
import { BottomNavigation } from '../components/BottomNavigation'
import { Colors } from '../constants/Colors'

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.subtitle}>Gestiona el perfil de tu ato-user</Text>
        </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.light.onSurface,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.onSurfaceSecondary,
    textAlign: 'center',
  },
})

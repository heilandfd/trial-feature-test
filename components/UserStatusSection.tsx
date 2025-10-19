import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useAto } from '../contexts/AtoContext'
import { Colors } from '../constants/Colors'

export const UserStatusSection: React.FC = () => {
  const { selectedUser } = useAto()

  if (!selectedUser) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>No hay usuario seleccionado</Text>
          <Text style={styles.subtitle}>Selecciona un usuario para ver su estado</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {selectedUser.nickname || selectedUser.name} sin novedades recientes
          </Text>
          <Text style={styles.subtitle}>
            No he hablado con {selectedUser.nickname || selectedUser.name} hoy ni tengo datos
            recientes.
          </Text>
          <View style={styles.emojiContainer}>
            <Text style={styles.emoji}>😊</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: -30,
    marginBottom: 24,
    zIndex: 1,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  content: {
    padding: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.onSurface,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.onSurfaceSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emojiContainer: {
    marginTop: 8,
  },
  emoji: {
    fontSize: 56,
  },
})

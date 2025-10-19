import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { BottomNavigation } from '../components/BottomNavigation'
import { useAto } from '../contexts/AtoContext'
import { useContacts } from '../hooks/useContacts'
import { Contact } from '../lib/ato-api'
import { ContactDisplayInfo } from '../types/api'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/Colors'

/**
 * ContactsScreen component displays and manages contacts for the selected ato-user
 * Allows viewing contact details and provides functionality to add/edit contacts
 */
export default function ContactsScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const { selectedUser } = useAto()
  const { contacts, loading, error, refreshContacts } = useContacts(selectedUser?.id || null)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshContacts()
    setRefreshing(false)
  }

  const handleAddContact = () => {
    Alert.alert('Agregar Contacto', 'Funcionalidad en desarrollo')
  }

  const handleEditContact = (contact: Contact) => {
    Alert.alert('Editar Contacto', `Editar ${contact.name} ${contact.surname}`)
  }

  /**
   * Gets the primary contact method value for a contact
   * @param contact - The contact object
   * @returns The primary contact method value or fallback text
   */
  const getPrimaryContactMethod = (contact: Contact): string => {
    const primaryMethod = contact.contact_methods.find(method => method.is_primary)
    return primaryMethod ? primaryMethod.value : 'Sin información'
  }

  /**
   * Formats contact data for display in the UI
   * @param contact - The contact object
   * @returns Formatted contact display information
   */
  const formatContactInfo = (contact: Contact): ContactDisplayInfo => {
    const fullName = `${contact.name} ${contact.surname}`
    const nickname =
      contact.other_names && contact.other_names.length > 0 ? contact.other_names[0] : contact.name

    return {
      name: fullName,
      subtitle: nickname,
      location: contact.location || 'Sin ubicación',
      phone: getPrimaryContactMethod(contact),
    }
  }

  if (!selectedUser) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>No hay usuario seleccionado</Text>
          </View>
        </SafeAreaView>
        <BottomNavigation />
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.accent} />
            <Text style={styles.loadingText}>Cargando contactos...</Text>
          </View>
        </SafeAreaView>
        <BottomNavigation />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refreshContacts}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <BottomNavigation />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Contactos</Text>
            <Text style={styles.subtitle}>
              {selectedUser.name} puede mandarle un mensaje o{'\n'}whatsapp a cualquiera de estas
              personas a{'\n'}través de Ato
            </Text>

            <TouchableOpacity style={styles.addButton} onPress={handleAddContact}>
              <Ionicons name="add" size={24} color="white" />
              <Text style={styles.addButtonText}>Agregar Contacto</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contactsList}>
            {contacts.map(contact => {
              const contactInfo = formatContactInfo(contact)
              return (
                <View key={contact.id} style={styles.contactCard}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contactInfo.name}</Text>
                    <Text style={styles.contactSubtitle}>{contactInfo.subtitle}</Text>

                    <View style={styles.contactDetail}>
                      <Ionicons name="person" size={16} color={Colors.light.onSurfaceSecondary} />
                      <Text style={styles.contactDetailText}>{contact.relationship}</Text>
                    </View>

                    <View style={styles.contactDetail}>
                      <Ionicons name="location" size={16} color={Colors.light.onSurfaceSecondary} />
                      <Text style={styles.contactDetailText}>{contactInfo.location}</Text>
                    </View>

                    <View style={styles.contactDetail}>
                      <Ionicons name="call" size={16} color={Colors.light.onSurfaceSecondary} />
                      <Text style={styles.contactDetailText}>{contactInfo.phone}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEditContact(contact)}
                  >
                    <Ionicons name="pencil" size={20} color={Colors.light.accent} />
                  </TouchableOpacity>
                </View>
              )
            })}

            {contacts.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No hay contactos registrados</Text>
                <Text style={styles.emptyStateSubtext}>
                  Agrega contactos para que {selectedUser.name} pueda comunicarse
                </Text>
              </View>
            )}
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.onSurfaceSecondary,
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
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
    lineHeight: 22,
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 300,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  contactsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  contactCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.onSurface,
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 14,
    color: Colors.light.onSurfaceSecondary,
    marginBottom: 12,
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  contactDetailText: {
    fontSize: 14,
    color: Colors.light.onSurfaceSecondary,
    marginLeft: 8,
    flex: 1,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.onSurfaceSecondary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.light.onSurfaceLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.light.accent,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})

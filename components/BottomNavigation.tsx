import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAssistant } from '../contexts/AssistantContext'
import { AssistantTrigger } from './assistant/AssistantTrigger'
import { Colors } from '../constants/Colors'

type IconName = keyof typeof Ionicons.glyphMap

interface Tab {
  label: string
  iconName: IconName
  route: string
}

interface TabItemProps extends Tab {
  isActive: boolean
  onPress: () => void
}

const LEFT_TABS: Tab[] = [
  { label: 'Inicio', iconName: 'home', route: '/dashboard' },
  { label: 'Contactos', iconName: 'book', route: '/contacts' },
]

const RIGHT_TABS: Tab[] = [
  { label: 'Perfil', iconName: 'person', route: '/profile' },
  { label: 'Ajustes', iconName: 'settings', route: '/settings' },
]

// Assistant trigger button configuration
const ASSISTANT_BUTTON_SIZE = 72
const ASSISTANT_BUTTON_GAP = 16 // Space reserved for the button (8px on each side)

const TabItem: React.FC<TabItemProps> = ({ label, iconName, onPress, isActive }) => (
  <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
      <Ionicons
        name={iconName}
        size={22}
        color={isActive ? Colors.light.accent : Colors.light.iconLight}
      />
    </View>
    <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
  </TouchableOpacity>
)

export const BottomNavigation: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const { openAssistant, state } = useAssistant()

  const handleTabPress = (route: string) => {
    if (pathname !== route) router.push(route as any)
  }

  const bottomPad = Math.max(insets.bottom, 10)

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={[styles.navBar, { paddingBottom: bottomPad }]}>
        <View style={styles.tabContainer}>
          <View style={styles.sideTabsContainer}>
            {LEFT_TABS.map(tab => (
              <TabItem
                key={tab.route}
                {...tab}
                isActive={pathname === tab.route}
                onPress={() => handleTabPress(tab.route)}
              />
            ))}
          </View>

          <View style={{ width: ASSISTANT_BUTTON_SIZE + ASSISTANT_BUTTON_GAP }} />

          <View style={styles.sideTabsContainer}>
            {RIGHT_TABS.map(tab => (
              <TabItem
                key={tab.route}
                {...tab}
                isActive={pathname === tab.route}
                onPress={() => handleTabPress(tab.route)}
              />
            ))}
          </View>
        </View>
      </View>

      <View
        style={[styles.centerTriggerOverlay, { bottom: bottomPad + 18 }]}
        pointerEvents="box-none"
      >
        <AssistantTrigger
          onPress={openAssistant}
          isActive={state.isOpen}
          size={ASSISTANT_BUTTON_SIZE}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  navBar: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'visible',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sideTabsContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
  },
  centerTriggerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    elevation: 12,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 6,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconContainerActive: {
    backgroundColor: Colors.light.state.activeBackground,
  },
  label: {
    fontSize: 11,
    color: Colors.light.iconLight,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
})

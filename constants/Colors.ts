/**
 * App-wide color design system
 *
 * Usage:
 * - Use Colors.light.primary or Colors.dark.primary
 * - Use getColor() helper for dynamic theme access
 * - Component-specific colors should stay in their files
 */

type ThemeMode = 'light' | 'dark'

/**
 * Internal color palette
 */
const Palette = {
  // Brand colors
  primary400: '#3CCEF5',
  primary500: '#18BCEB',
  primary600: '#00D4FF',

  // Accent
  accent400: '#60A5FA',
  accent500: '#3B82F6',
  accent600: '#2563EB',

  // Neutrals
  neutral50: '#F9FAFB',
  neutral100: '#F3F4F6',
  neutral200: '#E5E7EB',
  neutral300: '#D1D5DB',
  neutral400: '#9CA3AF',
  neutral500: '#6B7280',
  neutral600: '#4B5563',
  neutral700: '#374151',
  neutral800: '#1F2937',
  neutral900: '#111827',

  // Base
  white: '#FFFFFF',
  black: '#000000',

  // Feedback
  error500: '#EF4444',
  success500: '#10B981',
  warning500: '#F59E0B',

  // Special
  userMessageBg: '#3B82F6',
  userTimestamp: '#DBEAFE',
  activeTabBg: '#EBF4FF',
  recording: '#EF4444', // Red for recording state
} as const

/**
 * Public color system
 * Single export with semantic tokens organized by theme
 */
export const Colors = {
  light: {
    // Surfaces & backgrounds
    surface: Palette.white,
    surfaceVariant: Palette.neutral50,
    surfaceSecondary: Palette.neutral100,
    surfaceTertiary: Palette.neutral100,

    // Text & content
    onSurface: Palette.neutral900,
    onSurfaceSecondary: Palette.neutral500,
    onSurfaceTertiary: Palette.neutral700,
    onSurfaceLight: Palette.neutral400,

    // Brand
    primary: Palette.primary400,
    primaryDark: Palette.primary600,
    onPrimary: Palette.white,
    accent: Palette.accent500,
    onAccent: Palette.white,

    // Borders & dividers
    outline: Palette.neutral200,
    outlineVariant: Palette.neutral100,

    // Interactive states
    state: {
      focusRing: Palette.primary400,
      hover: 'rgba(0, 0, 0, 0.04)',
      pressed: 'rgba(0, 0, 0, 0.08)',
      disabled: Palette.neutral100,
      disabledText: Palette.neutral400,
      activeBackground: Palette.activeTabBg,
    },

    // Icons & indicators
    icon: Palette.neutral500,
    iconLight: Palette.neutral400,
    iconEmpty: Palette.neutral300,
    indicator: Palette.neutral200,

    // Shadow
    shadow: Palette.primary400,
    shadowDark: 'rgba(0, 0, 0, 0.1)',

    // Feedback
    error: Palette.error500,
    onError: Palette.white,
    success: Palette.success500,
    onSuccess: Palette.white,
    warning: Palette.warning500,
    onWarning: Palette.white,

    // Legacy for backward compatibility
    tint: '#0a7ea4',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
    background: Palette.white,
    text: Palette.neutral900,
  },
  dark: {
    // Surfaces & backgrounds
    surface: '#151718',
    surfaceVariant: '#1C1F22',
    surfaceSecondary: '#22262A',
    surfaceTertiary: '#2A2F34',

    // Text & content
    onSurface: '#ECEDEE',
    onSurfaceSecondary: '#9BA1A6',
    onSurfaceTertiary: '#B8BEC3',
    onSurfaceLight: '#6B7280',

    // Brand
    primary: Palette.primary400,
    primaryDark: Palette.primary500,
    onPrimary: '#0B1418',
    accent: Palette.accent400,
    onAccent: '#1A1A1A',

    // Borders & dividers
    outline: '#2A2F34',
    outlineVariant: '#22262A',

    // Interactive states
    state: {
      focusRing: Palette.primary400,
      hover: 'rgba(255, 255, 255, 0.06)',
      pressed: 'rgba(255, 255, 255, 0.12)',
      disabled: '#22262A',
      disabledText: '#6B7280',
    },

    // Icons & indicators
    icon: '#9BA1A6',
    iconLight: '#6B7280',
    iconEmpty: '#4B5563',
    indicator: '#2A2F34',

    // Shadow
    shadow: 'rgba(0, 0, 0, 0.5)',
    shadowDark: 'rgba(0, 0, 0, 0.8)',

    // Feedback
    error: '#FF6B6B',
    onError: '#1A1A1A',
    success: '#34D399',
    onSuccess: '#1A1A1A',
    warning: '#FBBF24',
    onWarning: '#1A1A1A',

    // Legacy/specific (kept for backward compatibility)
    tint: '#fff',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
    background: '#151718',
    text: '#ECEDEE',
  },
} as const

/**
 * Type helpers
 */
export type ColorRole = keyof (typeof Colors)['light']
export type ThemeColors = (typeof Colors)['light']

/**
 * Helper function to get color by role and theme mode
 */
export const getColor = (role: ColorRole, mode: ThemeMode): string => {
  return Colors[mode][role] as string
}

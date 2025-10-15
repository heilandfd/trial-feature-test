/**
 * Development and Store Testing Configuration
 *
 * Centralizes all mock data, testing credentials, and development bypasses.
 * This module provides a single source of truth for testing/demo mode.
 *
 * Usage:
 * - Import DevConfig in files that need testing bypasses
 * - Use checker functions (isTestEmail, isTestManager) instead of magic strings
 * - Use factory functions (createMockUser, createMockManager) for consistent mock data
 *
 * @example
 * import { DevConfig } from '@/lib/dev-config'
 *
 * if (DevConfig.isTestEmail(email)) {
 *   const mockUser = DevConfig.createMockUser()
 * }
 */

import type { User, Session } from '@supabase/supabase-js'
import type { AtoManager } from './ato-api'

// Environment-based feature flag
const isDevelopmentMode = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEV_MODE === 'true'

// Store testing credentials
const STORE_TESTING_CREDENTIALS = {
  email: 'gaspi+store-testing@ato.ar',
  otp: '181302',
  managerId: '32d49772-89e0-4f23-a80d-b3211888d3a2',
} as const

// AsyncStorage keys used for testing mode
const STORAGE_KEYS = {
  storeTestingUser: 'ato-store-testing-user',
} as const

// Mock session configuration
const MOCK_SESSION_CONFIG = {
  accessToken: 'store-testing-token',
  refreshToken: 'store-testing-refresh',
  expiresIn: 3600,
} as const

/**
 * Creates a mock Supabase User for testing purposes
 */
function createMockUser(): User {
  return {
    id: DevConfig.credentials.managerId,
    email: STORE_TESTING_CREDENTIALS.email,
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_metadata: { manager_id: DevConfig.credentials.managerId },
    app_metadata: {},
    aud: 'authenticated',
    confirmation_sent_at: new Date().toISOString(),
    recovery_sent_at: new Date().toISOString(),
    email_change_sent_at: new Date().toISOString(),
    new_email: undefined,
    invited_at: undefined,
    action_link: undefined,
    phone: undefined,
    phone_confirmed_at: undefined,
    phone_change_sent_at: undefined,
    confirmed_at: new Date().toISOString(),
    email_change_confirm_status: 0,
    banned_until: undefined,
    reauthentication_sent_at: undefined,
    is_anonymous: false,
  } as User
}

/**
 * Creates a mock Supabase Session for testing purposes
 */
function createMockSession(user: User): Session {
  return {
    user,
    access_token: MOCK_SESSION_CONFIG.accessToken,
    refresh_token: MOCK_SESSION_CONFIG.refreshToken,
    expires_in: MOCK_SESSION_CONFIG.expiresIn,
    token_type: 'bearer',
    expires_at: Date.now() / 1000 + MOCK_SESSION_CONFIG.expiresIn,
  } as Session
}

/**
 * Creates a mock AtoManager for testing purposes
 */
function createMockManager(managerId: string): AtoManager {
  return {
    id: managerId,
    name: 'Gaspar',
    surname: 'Habif',
    other_names: null,
    nickname: 'Gaspi',
    birthday: '1990-01-01',
    location: 'Buenos Aires',
    phone: '+54 9 11 1234-5678',
    uses_whatsapp: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: managerId,
    relationship: null,
  }
}

/**
 * Development and testing configuration
 * Provides centralized access to mock data and testing utilities
 */
export const DevConfig = {
  /**
   * Whether development/testing mode is enabled
   * Controlled by __DEV__ flag or EXPO_PUBLIC_ENABLE_DEV_MODE env var
   */
  enabled: isDevelopmentMode,

  /**
   * Store testing credentials for App Store review and demos
   */
  credentials: STORE_TESTING_CREDENTIALS,

  /**
   * AsyncStorage keys used in testing mode
   */
  storageKeys: STORAGE_KEYS,

  /**
   * Mock session configuration
   */
  sessionConfig: MOCK_SESSION_CONFIG,

  /**
   * Check if an email matches the test email
   */
  isTestEmail: (email: string): boolean =>
    isDevelopmentMode && email === STORE_TESTING_CREDENTIALS.email,

  /**
   * Check if an OTP matches the test OTP
   */
  isTestOtp: (otp: string): boolean => isDevelopmentMode && otp === STORE_TESTING_CREDENTIALS.otp,

  /**
   * Check if a manager ID matches the test manager ID
   */
  isTestManager: (managerId: string): boolean =>
    isDevelopmentMode && managerId === STORE_TESTING_CREDENTIALS.managerId,

  /**
   * Check if an access token matches the test token
   */
  isTestToken: (token: string): boolean =>
    isDevelopmentMode && token === MOCK_SESSION_CONFIG.accessToken,

  /**
   * Create a mock Supabase User
   */
  createMockUser,

  /**
   * Create a mock Supabase Session
   */
  createMockSession,

  /**
   * Create a mock AtoManager
   */
  createMockManager,
} as const

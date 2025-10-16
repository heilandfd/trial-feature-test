/**
 * OpenAI Function Tools Definitions
 *
 * Defines the tools/functions that the Realtime API can call.
 * These are used for:
 * 1. getUserReport - Get activity report for the elderly user
 * 2. getCurrentTime - Get current device time
 *
 * The Realtime API will automatically detect when to call these based on user intent.
 */

import { atoApi } from './ato-api'
import { DevConfig } from './dev-config'

/**
 * Tool Result Interface
 */
export interface ToolResult {
  success: boolean
  data?: any
  error?: string
}

/**
 * OpenAI Function Tool Schema for getUserReport
 *
 * This tool fetches a report about the elderly user's activity.
 * Includes: reminders, contacts, recent activity, etc.
 */
export const getUserReportTool = {
  type: 'function' as const,
  name: 'getUserReport',
  description:
    'Get a detailed activity report for the elderly user that the manager is caring for. Includes information about their reminders, contacts, and recent activity. Use this when the manager asks about how the user is doing, their schedule, reminders, or general wellbeing. The user ID is automatically provided from context.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}

/**
 * OpenAI Function Tool Schema for getCurrentTime
 *
 * Simple tool that returns the current device time.
 */
export const getCurrentTimeTool = {
  type: 'function' as const,
  name: 'getCurrentTime',
  description:
    'Get the current date and time from the device. Use this when the user asks for the current time, date, or what time it is.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}

/**
 * All available tools for the Realtime API
 */
export const allTools = [getUserReportTool, getCurrentTimeTool]

/**
 * Execute getUserReport Tool
 *
 * Calls the backend API to get the user report.
 *
 * @param userId - The ID of the user to get report for
 * @param authToken - Bearer token for authentication
 * @returns ToolResult with the report data
 */
export async function executeGetUserReport(userId: string, authToken: string): Promise<ToolResult> {
  try {
    // Use mock data in development mode
    if (DevConfig.enabled) {
      const mockReport = DevConfig.createMockUserReport()

      return {
        success: true,
        data: {
          summary: mockReport.summary,
          recent_activity: mockReport.recent_activity,
          upcoming_reminders: mockReport.upcoming_reminders,
          report_generated_at: mockReport.report_generated_at,
        },
      }
    }

    // Production: Real API call
    await atoApi.setAuthToken(authToken)
    const report = await atoApi.getUserReport(userId)

    return {
      success: true,
      data: {
        summary: report.summary,
        recent_activity: report.recent_activity,
        upcoming_reminders: report.upcoming_reminders,
        report_generated_at: report.report_generated_at,
      },
    }
  } catch (error) {
    console.error('[Tools] getUserReport error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Execute getCurrentTime Tool
 *
 * Returns the current device time in a formatted string.
 *
 * @param locale - Optional locale for formatting (default: 'en-US')
 * @returns ToolResult with current time data
 */
export function executeGetCurrentTime(locale: string = 'en-US'): ToolResult {
  try {
    const now = new Date()

    return {
      success: true,
      data: {
        currentTime: now.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        currentDate: now.toLocaleDateString(locale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        timestamp: now.toISOString(),
      },
    }
  } catch (error) {
    console.error('[Tools] getCurrentTime error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Execute a tool by name
 *
 * This is called when the Realtime API requests a tool execution.
 *
 * @param toolName - Name of the tool to execute
 * @param args - Arguments for the tool
 * @param context - Additional context (authToken, locale, etc.)
 * @returns ToolResult
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: { authToken?: string; locale?: string; userId?: string }
): Promise<ToolResult> {
  switch (toolName) {
    case 'getUserReport':
      // Use userId from context if not provided in args
      const userId = args.userId || context.userId

      if (!userId) {
        return { success: false, error: 'userId not available' }
      }
      if (!context.authToken) {
        return { success: false, error: 'authToken is required' }
      }
      return executeGetUserReport(userId, context.authToken)

    case 'getCurrentTime':
      return executeGetCurrentTime(context.locale)

    default:
      console.error('[Tools] Unknown tool:', toolName)
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

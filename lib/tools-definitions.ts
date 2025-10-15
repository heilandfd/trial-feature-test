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
    'Get a detailed activity report for the elderly user. Includes information about their reminders, contacts, and recent activity. Use this when the manager asks about how the user is doing, their schedule, reminders, or general wellbeing.',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The ID of the elderly user to get the report for',
      },
    },
    required: ['userId'],
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
    console.log('[Tools] Executing getUserReport for userId:', userId)

    // Set the auth token for the API call
    await atoApi.setAuthToken(authToken)

    // Call the API
    const report = await atoApi.getUserReport(userId)

    console.log('[Tools] getUserReport success:', {
      reminders: report.summary.total_reminders,
      contacts: report.summary.total_contacts,
    })

    // Return formatted result
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

    console.log('[Tools] Executing getCurrentTime')

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
  context: { authToken?: string; locale?: string }
): Promise<ToolResult> {
  console.log('[Tools] Executing tool:', toolName, 'with args:', args)

  switch (toolName) {
    case 'getUserReport':
      if (!args.userId) {
        return { success: false, error: 'userId is required' }
      }
      if (!context.authToken) {
        return { success: false, error: 'authToken is required' }
      }
      return executeGetUserReport(args.userId, context.authToken)

    case 'getCurrentTime':
      return executeGetCurrentTime(context.locale)

    default:
      console.error('[Tools] Unknown tool:', toolName)
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

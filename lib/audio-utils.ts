/**
 * Audio Utilities for Voice Recording and Playback
 *
 * This module handles:
 * 1. Microphone permission requests
 * 2. Audio recording configuration
 * 3. Audio playback
 * 4. Audio format conversion for OpenAI Realtime API
 *
 * Uses expo-av for all audio operations.
 */

import { Audio, type AVPlaybackStatus } from 'expo-av'
import * as FileSystem from 'expo-file-system'

/**
 * Audio recording configuration optimized for speech
 *
 * Settings:
 * - Sample rate: 24000 Hz (required by OpenAI Realtime API)
 * - Channels: 1 (mono)
 * - Encoding: PCM 16-bit (best quality for speech)
 * - Format: WAV (compatible with OpenAI)
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC_ELD, // Enhanced Low Delay
    sampleRate: 44100, // Standard rate (16000 causes recording errors)
    numberOfChannels: 1,
    bitRate: 64000, // Reduced for faster upload
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 44100, // Standard rate (16000 causes recording errors)
    numberOfChannels: 1,
    bitRate: 64000, // Reduced for faster upload
  },
  web: {
    mimeType: 'audio/mp4',
    bitsPerSecond: 128000,
  },
}

/**
 * Request microphone permissions
 *
 * Must be called before recording.
 * Shows native permission dialog to user.
 *
 * @returns Promise<boolean> - true if permission granted
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    // First check if we already have permission
    const { status: existingStatus } = await Audio.getPermissionsAsync()

    if (existingStatus === 'granted') {
      return true
    }

    // Only request if we don't have it
    const { status } = await Audio.requestPermissionsAsync()

    if (status === 'granted') {
      return true
    } else {
      console.error('[Audio] Microphone permission denied')
      return false
    }
  } catch (error) {
    console.error('[Audio] Error requesting microphone permission:', error)
    return false
  }
}

/**
 * Check if microphone permission is already granted
 *
 * @returns Promise<boolean> - true if already granted
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Audio.getPermissionsAsync()
    return status === 'granted'
  } catch (error) {
    console.error('[Audio] Error checking microphone permission:', error)
    return false
  }
}

/**
 * Start audio recording
 *
 * Steps:
 * 1. Set audio mode for recording
 * 2. Create recording instance
 * 3. Prepare with optimized settings
 * 4. Start recording
 *
 * @returns Promise<Audio.Recording> - Active recording instance
 * @throws Error if recording fails to start
 */
export async function startRecording(): Promise<Audio.Recording> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    })

    const recording = new Audio.Recording()
    await recording.prepareToRecordAsync(RECORDING_OPTIONS)
    await recording.startAsync()

    return recording
  } catch (error) {
    console.error('[Audio] Error starting recording:', error)
    throw new Error(
      'Failed to start recording: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
}

/**
 * Stop audio recording and get file URI
 *
 * @param recording - The active recording instance
 * @returns Promise<string> - URI of the recorded audio file
 * @throws Error if stopping recording fails
 */
export async function stopRecording(recording: Audio.Recording): Promise<string> {
  try {
    // Check if recording is in a valid state
    const status = await recording.getStatusAsync()
    if (!status.canRecord && !status.isRecording && !status.isDoneRecording) {
      throw new Error('Recording is not in a valid state to stop')
    }

    await recording.stopAndUnloadAsync()
    const uri = recording.getURI()

    if (!uri) {
      throw new Error('No URI returned from recording')
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    })

    return uri
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : ''
    // Silently ignore "does not exist" errors - recording may be cleaned up
    if (!errorMessage.includes('does not exist')) {
      console.error('[Audio] Error stopping recording:', error)
    }
    throw new Error(
      'Failed to stop recording: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
}

/**
 * Get recording duration
 *
 * @param recording - The active recording instance
 * @returns Promise<number> - Duration in milliseconds
 */
export async function getRecordingDuration(recording: Audio.Recording): Promise<number> {
  try {
    const status = await recording.getStatusAsync()
    return status.isRecording ? status.durationMillis : 0
  } catch (error) {
    console.error('[Audio] Error getting recording duration:', error)
    return 0
  }
}

/**
 * Delete audio file
 *
 * Clean up temporary audio files after use.
 *
 * @param uri - File URI to delete
 */
export async function deleteAudioFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true })
  } catch (error) {
    console.error('[Audio] Error deleting file:', error)
  }
}

/**
 * Play audio from URI
 *
 * Used to play AI response audio from OpenAI.
 *
 * @param uri - File URI or data URI of audio to play
 * @returns Promise<Audio.Sound> - Sound instance for control
 */
export async function playAudio(uri: string): Promise<Audio.Sound> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    })

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    )

    return sound
  } catch (error) {
    console.error('[Audio] Error playing audio:', error)
    throw new Error(
      'Failed to play audio: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
}

/**
 * Stop audio playback
 *
 * @param sound - The sound instance to stop
 */
export async function stopAudio(sound: Audio.Sound): Promise<void> {
  try {
    await sound.stopAsync()
    await sound.unloadAsync()
  } catch (error) {
    // Silently ignore interruption errors when user stops audio
    const errorMessage = error instanceof Error ? error.message : ''
    if (!errorMessage.includes('interrupted')) {
      console.error('[Audio] Error stopping audio:', error)
    }
  }
}

/**
 * Playback status update callback
 *
 * Logs playback progress and handles completion.
 */
function onPlaybackStatusUpdate(status: AVPlaybackStatus) {
  if (!status.isLoaded && status.error) {
    console.error('[Audio] Playback error:', status.error)
  }
}

// REMOVED: base64ToAudioUri - no longer needed, TTS uses react-native-blob-util directly

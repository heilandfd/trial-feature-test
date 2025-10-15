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

import { Audio } from 'expo-av'
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
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 24000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 24000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
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
    console.log('[Audio] Requesting microphone permission...')

    const { status } = await Audio.requestPermissionsAsync()

    if (status === 'granted') {
      console.log('[Audio] Microphone permission granted')
      return true
    } else {
      console.log('[Audio] Microphone permission denied')
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
    console.log('[Audio] Starting recording...')

    // Set audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    })

    // Create and prepare recording
    const recording = new Audio.Recording()
    await recording.prepareToRecordAsync(RECORDING_OPTIONS)

    // Start recording
    await recording.startAsync()

    console.log('[Audio] Recording started successfully')
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
    console.log('[Audio] Stopping recording...')

    await recording.stopAndUnloadAsync()
    const uri = recording.getURI()

    if (!uri) {
      throw new Error('No URI returned from recording')
    }

    // Get file info for debugging
    const fileInfo = await FileSystem.getInfoAsync(uri)
    console.log('[Audio] Recording stopped. File info:', {
      uri,
      size: 'size' in fileInfo ? fileInfo.size : 'unknown',
      exists: fileInfo.exists,
    })

    // Reset audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    })

    return uri
  } catch (error) {
    console.error('[Audio] Error stopping recording:', error)
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
 * Read audio file as base64
 *
 * This is used to send audio to OpenAI Realtime API.
 *
 * @param uri - File URI of the audio
 * @returns Promise<string> - Base64 encoded audio data
 */
export async function readAudioAsBase64(uri: string): Promise<string> {
  try {
    console.log('[Audio] Reading audio file as base64:', uri)

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    console.log('[Audio] Audio file read successfully, size:', base64.length, 'chars')
    return base64
  } catch (error) {
    console.error('[Audio] Error reading audio file:', error)
    throw new Error(
      'Failed to read audio file: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
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
    console.log('[Audio] Deleting audio file:', uri)
    await FileSystem.deleteAsync(uri, { idempotent: true })
    console.log('[Audio] Audio file deleted')
  } catch (error) {
    console.error('[Audio] Error deleting audio file:', error)
    // Don't throw - deletion errors are not critical
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
    console.log('[Audio] Playing audio from URI:', uri.substring(0, 50) + '...')

    // Set audio mode for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    })

    // Load and play sound
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    )

    console.log('[Audio] Audio playback started')
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
    console.log('[Audio] Stopping audio playback')
    await sound.stopAsync()
    await sound.unloadAsync()
    console.log('[Audio] Audio playback stopped')
  } catch (error) {
    console.error('[Audio] Error stopping audio:', error)
    // Don't throw - stopping errors are not critical
  }
}

/**
 * Playback status update callback
 *
 * Logs playback progress and handles completion.
 */
function onPlaybackStatusUpdate(status: Audio.AVPlaybackStatus) {
  if (status.isLoaded) {
    if (status.didJustFinish) {
      console.log('[Audio] Playback finished')
    }
    if (status.isPlaying) {
      // Could update UI with progress here if needed
      // console.log('[Audio] Playing:', status.positionMillis, '/', status.durationMillis)
    }
  } else if (status.error) {
    console.error('[Audio] Playback error:', status.error)
  }
}

/**
 * Convert base64 audio to playable URI
 *
 * OpenAI returns audio as base64, we need to convert it to a file URI for playback.
 *
 * @param base64Audio - Base64 encoded audio data
 * @param format - Audio format extension (default: 'wav')
 * @returns Promise<string> - File URI for playback
 */
export async function base64ToAudioUri(
  base64Audio: string,
  format: string = 'wav'
): Promise<string> {
  try {
    // Create temporary file path
    const fileUri = `${FileSystem.cacheDirectory}response_audio_${Date.now()}.${format}`

    console.log('[Audio] Converting base64 to audio file:', fileUri)

    // Write base64 data to file
    await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
      encoding: FileSystem.EncodingType.Base64,
    })

    console.log('[Audio] Audio file created successfully')
    return fileUri
  } catch (error) {
    console.error('[Audio] Error converting base64 to audio:', error)
    throw new Error(
      'Failed to convert audio: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
}

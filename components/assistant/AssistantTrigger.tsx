import React, { useEffect } from 'react'
import { TouchableOpacity, StyleSheet, View, Platform } from 'react-native'
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated'
import { Colors } from '../../constants/Colors'

interface AssistantTriggerProps {
  onPress: () => void
  isActive?: boolean
  isListening?: boolean
  size?: number
}

const DEFAULT_SIZE = 72
const INNER_RATIO = 0.76
const HALO_WIDTH = 220
const HALO_HEIGHT = 110

const WaveRing: React.FC<{ size: number; delay: number; isListening: boolean }> = ({
  size,
  delay,
  isListening,
}) => {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  useEffect(() => {
    if (isListening) {
      // Start animation with delay
      setTimeout(() => {
        scale.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 0 }),
            withTiming(1.8, { duration: 2000, easing: Easing.out(Easing.quad) })
          ),
          -1,
          false
        )
        opacity.value = withRepeat(
          withSequence(
            withTiming(0.3, { duration: 200 }),
            withTiming(0, { duration: 1800, easing: Easing.out(Easing.quad) })
          ),
          -1,
          false
        )
      }, delay)
    } else {
      // Stop animation
      scale.value = withTiming(1, { duration: 300 })
      opacity.value = withTiming(0, { duration: 300 })
    }
  }, [isListening, delay, scale, opacity])

  return (
    <Animated.View
      style={[
        styles.waveRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  )
}

export const AssistantTrigger: React.FC<AssistantTriggerProps> = ({
  onPress,
  isActive = false,
  isListening = false,
  size = DEFAULT_SIZE,
}) => {
  const SIZE = size
  const innerSize = Math.round(SIZE * INNER_RATIO)
  const outerColor = isActive ? Colors.light.primaryDark : Colors.light.primary

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* Background Halo */}
      <View pointerEvents="none" style={styles.haloWrap}>
        <Svg width={HALO_WIDTH} height={HALO_HEIGHT} style={styles.haloSvg}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="100%">
              <Stop offset="20%" stopColor={Colors.light.primary} stopOpacity="0.40" />
              <Stop offset="55%" stopColor={Colors.light.primary} stopOpacity="0.18" />
              <Stop offset="100%" stopColor={Colors.light.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO_WIDTH / 2} cy={HALO_WIDTH / 2} r={HALO_WIDTH / 2} fill="url(#halo)" />
        </Svg>
      </View>

      {/* Wave Animation Rings (only when listening) */}
      {isListening && (
        <>
          <WaveRing size={SIZE * 1.6} delay={0} isListening={isListening} />
          <WaveRing size={SIZE * 1.6} delay={600} isListening={isListening} />
          <WaveRing size={SIZE * 1.6} delay={1200} isListening={isListening} />
        </>
      )}

      {/* Main Button */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        style={[
          styles.ring,
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            backgroundColor: outerColor,
          },
        ]}
      >
        <View style={{ width: innerSize, height: innerSize }}>
          <Svg width={innerSize} height={innerSize} viewBox="0 0 60 60">
            <Path
              d="
                M30 9
                C38 9 46 14.6 48.6 22.5
                C51.1 30.2 47.6 38.9 40.4 44.1
                C33.2 49.2 23.1 50.1 16.4 45.1
                C9.8 40.3 8.0 31.0 11.5 23.7
                C15.0 16.5 22.7 11.3 30 9
                Z
              "
              fill="#FFFFFF"
              transform="
                translate(30 30)
                rotate(-6)
                scale(1.10 1.06)
                translate(-30 -30)
                translate(0 0.6)
              "
            />
          </Svg>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const SHADOW_STYLES = Platform.select({
  ios: {
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  android: {
    elevation: 10,
  },
})

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  haloWrap: {
    position: 'absolute',
    height: HALO_HEIGHT,
    width: HALO_WIDTH,
    overflow: 'hidden',
    zIndex: 0,
  },
  haloSvg: { position: 'absolute', bottom: 0 },
  waveRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.light.primary,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...SHADOW_STYLES,
  },
})

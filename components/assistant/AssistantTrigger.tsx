import React from 'react'
import { TouchableOpacity, StyleSheet, View, Platform } from 'react-native'
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg'
import * as Haptics from 'expo-haptics'

interface AssistantTriggerProps {
  onPress: () => void
  isActive?: boolean
  size?: number
}

const DEFAULT_SIZE = 72
const INNER_RATIO = 0.76
const HALO_WIDTH = 220
const HALO_HEIGHT = 110

export const AssistantTrigger: React.FC<AssistantTriggerProps> = ({
  onPress,
  isActive = false,
  size = DEFAULT_SIZE,
}) => {
  const SIZE = size
  const innerSize = Math.round(SIZE * INNER_RATIO)
  const outerColor = isActive ? '#00D4FF' : '#3CCEF5'

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View pointerEvents="none" style={styles.haloWrap}>
        <Svg width={HALO_WIDTH} height={HALO_HEIGHT} style={styles.haloSvg}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="100%">
              <Stop offset="20%" stopColor="#3CCEF5" stopOpacity="0.40" />
              <Stop offset="55%" stopColor="#3CCEF5" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#3CCEF5" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO_WIDTH / 2} cy={HALO_WIDTH / 2} r={HALO_WIDTH / 2} fill="url(#halo)" />
        </Svg>
      </View>

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
    shadowColor: '#3CCEF5',
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
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    ...SHADOW_STYLES,
  },
})

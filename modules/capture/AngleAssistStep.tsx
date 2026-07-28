import * as Haptics from 'expo-haptics';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

const ALIGNMENT_THRESHOLD_DEGREES = 5;

type Props = {
  slotLabel: string;
  targetAngleDegrees: number;
  onAligned: () => void;
};

// Tilt/level only — no camera preview. Can confirm phone pitch matches the slot's target
// angle (e.g. a top-down shot); cannot verify physical position (e.g. which side of the
// object the phone is on) — that's on the researcher.
export default function AngleAssistStep({ slotLabel, targetAngleDegrees, onAligned }: Props) {
  const [currentAngle, setCurrentAngle] = useState<number | null>(null);
  const wasAlignedRef = useRef(false);

  useEffect(() => {
    DeviceMotion.setUpdateInterval(100);
    const subscription = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;
      const angleDegrees = rotation.beta * (180 / Math.PI);
      setCurrentAngle(angleDegrees);

      const aligned = Math.abs(angleDegrees - targetAngleDegrees) <= ALIGNMENT_THRESHOLD_DEGREES;
      if (aligned && !wasAlignedRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      wasAlignedRef.current = aligned;
    });

    return () => subscription.remove();
  }, [targetAngleDegrees]);

  const aligned =
    currentAngle !== null && Math.abs(currentAngle - targetAngleDegrees) <= ALIGNMENT_THRESHOLD_DEGREES;

  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <View
        className={`h-64 w-64 items-center justify-center border-4 ${
          aligned ? 'border-primary' : 'border-hairline-strong'
        }`}
      >
        <Text className={`font-inter-black text-[32px] ${aligned ? 'text-primary' : 'text-ink'}`}>
          {currentAngle === null ? '—' : `${currentAngle.toFixed(0)}°`}
        </Text>
        <Text className="mt-1 font-inter-light text-sm text-body">Target {targetAngleDegrees}°</Text>
      </View>

      <Text className="mt-8 font-inter-bold text-base text-body-strong">{slotLabel}</Text>
      <Text className="mt-2 text-center font-inter-light text-base text-body">
        Level the phone until the border turns green.
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue to camera"
        activeOpacity={0.85}
        disabled={!aligned}
        onPress={onAligned}
        className={`mt-10 h-[56px] w-full items-center justify-center ${
          aligned ? 'bg-primary' : 'bg-surface-elevated'
        }`}
      >
        <Text
          className={`font-inter-bold text-[13px] uppercase tracking-[1.2px] ${
            aligned ? 'text-primary-on' : 'text-muted'
          }`}
        >
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}

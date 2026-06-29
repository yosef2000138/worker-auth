import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { LogoMark, authPalette } from '@/components/auth';
import { useLanguage } from '@/i18n';
import { RootStackParamList } from '@/types';
import { hasSeenOnboarding } from '@/utils/onboarding';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  const { t, isRTL } = useLanguage();
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: 1450, useNativeDriver: false }),
    ]).start();
    pulseLoop.start();

    let mounted = true;
    const timer = setTimeout(() => {
      hasSeenOnboarding()
        .then(seen => {
          if (mounted) navigation.replace(seen ? 'Login' : 'Onboarding');
        })
        .catch(() => {
          if (mounted) navigation.replace('Onboarding');
        });
    }, 1550);

    return () => {
      mounted = false;
      clearTimeout(timer);
      pulseLoop.stop();
    };
  }, [fade, navigation, progress, pulse]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.center, { opacity: fade }]}>
        <LogoMark size={86} animatedValue={pulse} />
        <Text style={styles.title}>Worker</Text>
        <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('splash.subtitle')}</Text>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ['16%', '100%'] }),
              },
            ]}
          />
        </View>
        <ActivityIndicator color={authPalette.primary} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authPalette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', width: '100%', maxWidth: 360 },
  title: { color: authPalette.ink, fontSize: 36, lineHeight: 42, fontWeight: '900', marginTop: 22, letterSpacing: 0 },
  subtitle: { color: authPalette.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  rtlText: { writingDirection: 'rtl' },
  progressTrack: { width: '72%', height: 6, borderRadius: 999, backgroundColor: '#EAECF0', overflow: 'hidden', marginBottom: 18 },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: authPalette.primary },
});

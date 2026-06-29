import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AuthButton, LogoMark, TextAction, authPalette } from '@/components/auth';
import { LanguageSelector } from '@/components/language/LanguageSelector';
import { useLanguage } from '@/i18n';
import { RootStackParamList } from '@/types';
import { markOnboardingSeen } from '@/utils/onboarding';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;
type IconName = keyof typeof Ionicons.glyphMap;

function getPages(t: ReturnType<typeof useLanguage>['t']): {
  icon: IconName;
  eyebrow: string;
  title: string;
  body: string;
  bullets: { icon: IconName; text: string }[];
  accent: string;
}[] {
  return [
    {
      icon: 'home-outline',
      eyebrow: t('onboarding.p1Eyebrow'),
      title: t('onboarding.p1Title'),
      body: t('onboarding.p1Body'),
      accent: '#2563EB',
      bullets: [
        { icon: 'location-outline', text: t('onboarding.p1Bullet1') },
        { icon: 'chatbubbles-outline', text: t('onboarding.p1Bullet2') },
        { icon: 'card-outline', text: t('onboarding.p1Bullet3') },
      ],
    },
    {
      icon: 'construct-outline',
      eyebrow: t('onboarding.p2Eyebrow'),
      title: t('onboarding.p2Title'),
      body: t('onboarding.p2Body'),
      accent: '#16A34A',
      bullets: [
        { icon: 'notifications-outline', text: t('onboarding.p2Bullet1') },
        { icon: 'calendar-outline', text: t('onboarding.p2Bullet2') },
        { icon: 'checkmark-done-outline', text: t('onboarding.p2Bullet3') },
      ],
    },
    {
      icon: 'shield-checkmark-outline',
      eyebrow: t('onboarding.p3Eyebrow'),
      title: t('onboarding.p3Title'),
      body: t('onboarding.p3Body'),
      accent: '#111827',
      bullets: [
        { icon: 'checkmark-done-outline', text: t('onboarding.p3Bullet1') },
        { icon: 'star-outline', text: t('onboarding.p3Bullet2') },
        { icon: 'lock-closed-outline', text: t('onboarding.p3Bullet3') },
      ],
    },
  ];
}

export default function OnboardingScreen({ navigation }: Props) {
  const { t, isRTL } = useLanguage();
  const [index, setIndex] = useState(0);
  const transition = useRef(new Animated.Value(1)).current;
  const { width } = useWindowDimensions();
  const pages = getPages(t);
  const page = pages[index];
  const isLast = index === pages.length - 1;

  const animateTo = (nextIndex: number) => {
    Animated.timing(transition, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setIndex(nextIndex);
      Animated.timing(transition, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    });
  };

  const openLogin = async () => {
    try {
      await markOnboardingSeen();
    } finally {
      navigation.navigate('Login');
    }
  };

  const openRegister = async () => {
    try {
      await markOnboardingSeen();
    } finally {
      navigation.navigate('Register');
    }
  };

  const handleNext = () => {
    if (isLast) {
      void openLogin();
      return;
    }
    animateTo(index + 1);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.topBar, isRTL && styles.rowReverse]}>
        <View style={styles.brandRow}>
          <LogoMark size={38} />
          <Text style={styles.brand}>Worker</Text>
        </View>
        <View style={[styles.topActions, isRTL && styles.rowReverse]}>
          <LanguageSelector />
          <TextAction text={t('onboarding.skip')} onPress={() => void openLogin()} />
        </View>
      </View>

      <Animated.View
        style={[
          styles.pageWrap,
          {
            opacity: transition,
            transform: [{ translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [width * 0.08, 0] }) }],
          },
        ]}
      >
        <View style={[styles.illustration, { backgroundColor: page.accent }]}>
          <View style={styles.illustrationGlow} />
          <View style={styles.iconBubble}>
            <Ionicons name={page.icon} size={58} color={authPalette.textInverse} />
          </View>
          <View style={styles.floatingCardA}>
            <Ionicons name="checkmark-circle" size={18} color={authPalette.accent} />
            <Text style={styles.floatingText}>{t('onboarding.verified')}</Text>
          </View>
          <View style={styles.floatingCardB}>
            <Ionicons name="time-outline" size={18} color={authPalette.brand} />
            <Text style={styles.floatingText}>{t('onboarding.liveStatus')}</Text>
          </View>
        </View>

        <Text style={[styles.eyebrow, { color: page.accent }, isRTL && styles.rtlText]}>{page.eyebrow}</Text>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{page.title}</Text>
        <Text style={[styles.body, isRTL && styles.rtlText]}>{page.body}</Text>

        <View style={styles.bulletList}>
          {page.bullets.map(item => (
            <View key={item.text} style={[styles.bulletRow, isRTL && styles.rowReverse]}>
              <View style={styles.bulletIcon}>
                <Ionicons name={item.icon} size={17} color={page.accent} />
              </View>
              <Text style={[styles.bulletText, isRTL && styles.rtlText]}>{item.text}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {pages.map((item, dotIndex) => (
            <Pressable key={item.title} onPress={() => animateTo(dotIndex)} hitSlop={8}>
              <View style={[styles.dot, dotIndex === index && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
        <AuthButton title={isLast ? t('onboarding.signIn') : t('onboarding.next')} icon={isLast ? 'log-in-outline' : 'arrow-forward'} onPress={handleNext} />
        <AuthButton title={t('auth.createAccount')} variant="secondary" icon="person-add-outline" onPress={() => void openRegister()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authPalette.bg, paddingHorizontal: 20 },
  topBar: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowReverse: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: authPalette.ink, fontSize: 18, fontWeight: '900' },
  pageWrap: { flex: 1, paddingTop: 12 },
  illustration: {
    height: 250,
    borderRadius: 30,
    padding: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#101828',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  illustrationGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFFFFF', opacity: 0.12, top: -42, right: -46 },
  iconBubble: { width: 116, height: 116, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  floatingCardA: { position: 'absolute', left: 18, top: 26, backgroundColor: authPalette.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', gap: 7, alignItems: 'center' },
  floatingCardB: { position: 'absolute', right: 18, bottom: 26, backgroundColor: authPalette.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', gap: 7, alignItems: 'center' },
  floatingText: { color: authPalette.ink, fontSize: 12, fontWeight: '900' },
  eyebrow: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  title: { color: authPalette.ink, fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: 0 },
  body: { color: authPalette.muted, fontSize: 15, lineHeight: 23, marginTop: 12 },
  bulletList: { marginTop: 22, gap: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bulletIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: authPalette.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EAECF0' },
  bulletText: { flex: 1, color: authPalette.ink, fontSize: 14, fontWeight: '800' },
  bottom: { gap: 12, paddingBottom: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D0D5DD' },
  dotActive: { width: 26, backgroundColor: authPalette.primary },
});

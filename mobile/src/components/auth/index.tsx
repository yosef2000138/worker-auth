import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/i18n';

export const authPalette = {
  bg: '#F4F7FB',
  ink: '#101828',
  muted: '#667085',
  soft: '#EEF4FF',
  surface: '#FFFFFF',
  line: '#D0D5DD',
  lineStrong: '#98A2B3',
  primary: '#111827',
  brand: '#2563EB',
  accent: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  dangerSoft: '#FEE4E2',
  successSoft: '#DCFCE7',
  textInverse: '#FFFFFF',
};

type IconName = keyof typeof Ionicons.glyphMap;

export function AuthScaffold({
  children,
  eyebrow,
  title,
  subtitle,
  footer,
  topAccessory,
  centered = false,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  topAccessory?: React.ReactNode;
  centered?: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [intro]);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, centered && styles.scrollCentered]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: intro,
              transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            },
          ]}
        >
          {topAccessory ? <View style={styles.topAccessory}>{topAccessory}</View> : null}
          <View style={[styles.brandRow, isRTL && styles.rowReverse]}>
            <LogoMark size={42} />
            <View>
              <Text style={[styles.brandText, isRTL && styles.rtlText]}>Worker</Text>
              <Text style={[styles.brandSubtext, isRTL && styles.rtlText]}>{t('common.brandSubtitle')}</Text>
            </View>
          </View>

          <View style={styles.heroCopy}>
            {eyebrow ? <Text style={[styles.eyebrow, isRTL && styles.rtlText]}>{eyebrow}</Text> : null}
            <Text style={[styles.title, isRTL && styles.rtlText]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{subtitle}</Text> : null}
          </View>

          <View style={styles.card}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function LogoMark({ size = 54, animatedValue }: { size?: number; animatedValue?: Animated.Value }) {
  const pulse = animatedValue
    ? {
        transform: [
          {
            scale: animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }),
          },
        ],
      }
    : undefined;

  return (
    <Animated.View style={[styles.logoMark, { width: size, height: size, borderRadius: size * 0.32 }, pulse]}>
      <Ionicons name="briefcase" size={Math.round(size * 0.48)} color={authPalette.textInverse} />
    </Animated.View>
  );
}

export function AuthInput({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  onRightPress,
  containerStyle,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const { isRTL, copy } = useLanguage();
  const naturalLtr =
    props.secureTextEntry
    || props.keyboardType === 'email-address'
    || props.keyboardType === 'phone-pad'
    || props.keyboardType === 'number-pad'
    || props.keyboardType === 'numeric'
    || props.keyboardType === 'decimal-pad'
    || props.keyboardType === 'url';
  const textDirection = naturalLtr ? 'ltr' : isRTL ? 'rtl' : 'ltr';

  return (
    <View style={[styles.inputBlock, containerStyle]}>
      <Text style={[styles.label, isRTL && styles.rtlText]}>{copy(label)}</Text>
      <View style={[styles.inputWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }, error && styles.inputWrapError]}>
        {leftIcon ? <Ionicons name={leftIcon} size={19} color={authPalette.muted} /> : null}
        <TextInput
          placeholderTextColor="#98A2B3"
          style={[styles.input, { textAlign: naturalLtr ? 'left' : isRTL ? 'right' : 'left', writingDirection: textDirection }]}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {rightIcon ? (
          <Pressable hitSlop={10} onPress={onRightPress}>
            <Ionicons name={rightIcon} size={20} color={authPalette.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.errorText, isRTL && styles.rtlText]}>{copy(error)}</Text> : helper ? <Text style={[styles.helperText, isRTL && styles.rtlText]}>{copy(helper)}</Text> : null}
    </View>
  );
}

export function AuthButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
  style,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { isRTL, copy } = useLanguage();
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const fg = isSecondary || isGhost ? authPalette.ink : authPalette.textInverse;

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.authButton,
        isSecondary && styles.authButtonSecondary,
        isGhost && styles.authButtonGhost,
        (disabled || loading) && styles.authButtonDisabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={[styles.buttonContent, isRTL && styles.rowReverse]}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.authButtonText, { color: fg }]}>{copy(title)}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TextAction({ text, onPress }: { text: string; onPress: () => void }) {
  const { isRTL, copy } = useLanguage();
  return (
    <Pressable hitSlop={8} onPress={onPress}>
      <Text style={[styles.textAction, isRTL && styles.rtlText]}>{copy(text)}</Text>
    </Pressable>
  );
}

export function AuthBanner({
  tone,
  title,
  message,
}: {
  tone: 'success' | 'danger' | 'info';
  title: string;
  message?: string;
}) {
  const { isRTL, copy } = useLanguage();
  const icon = tone === 'success' ? 'checkmark-circle' : tone === 'danger' ? 'alert-circle' : 'information-circle';
  const bg = tone === 'success' ? authPalette.successSoft : tone === 'danger' ? authPalette.dangerSoft : authPalette.soft;
  const fg = tone === 'success' ? authPalette.accent : tone === 'danger' ? authPalette.danger : authPalette.brand;

  return (
    <View style={[styles.banner, { backgroundColor: bg }, isRTL && styles.rowReverse]}>
      <Ionicons name={icon} size={20} color={fg} />
      <View style={styles.bannerCopy}>
        <Text style={[styles.bannerTitle, { color: fg }, isRTL && styles.rtlText]}>{copy(title)}</Text>
        {message ? <Text style={[styles.bannerMessage, isRTL && styles.rtlText]}>{copy(message)}</Text> : null}
      </View>
    </View>
  );
}

export function CheckRow({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  const { isRTL, copy } = useLanguage();
  return (
    <Pressable style={[styles.checkRow, isRTL && styles.rowReverse]} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" size={14} color={authPalette.textInverse} /> : null}
      </View>
      <Text style={[styles.checkLabel, isRTL && styles.rtlText]}>{copy(label)}</Text>
    </Pressable>
  );
}

export function RoleOption({
  selected,
  icon,
  title,
  description,
  onPress,
}: {
  selected: boolean;
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { isRTL, copy } = useLanguage();
  return (
    <Pressable onPress={onPress} style={[styles.roleOption, isRTL && styles.rowReverse, selected && styles.roleOptionSelected]}>
      <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
        <Ionicons name={icon} size={22} color={selected ? authPalette.textInverse : authPalette.brand} />
      </View>
      <View style={styles.roleCopy}>
        <Text style={[styles.roleTitle, isRTL && styles.rtlText]}>{copy(title)}</Text>
        <Text style={[styles.roleDescription, isRTL && styles.rtlText]}>{copy(description)}</Text>
      </View>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? authPalette.brand : authPalette.lineStrong} />
    </Pressable>
  );
}

export function StepIndicator({ step, total, label }: { step: number; total: number; label?: string }) {
  const { isRTL, copy } = useLanguage();
  return (
    <View style={styles.stepWrap}>
      <Text style={[styles.stepText, isRTL && styles.rtlText]}>{label ? copy(label) : `Step ${step} of ${total}`}</Text>
      <View style={[styles.stepRail, isRTL && styles.rowReverse]}>
        {Array.from({ length: total }).map((_, index) => (
          <View key={index} style={[styles.stepDot, index < step && styles.stepDotActive]} />
        ))}
      </View>
    </View>
  );
}

export function PasswordStrength({ score, labels }: { score: number; labels?: { strong: string; good: string; fair: string; weak: string } }) {
  const { isRTL } = useLanguage();
  const label = score >= 4 ? labels?.strong ?? 'Strong' : score >= 3 ? labels?.good ?? 'Good' : score >= 2 ? labels?.fair ?? 'Fair' : labels?.weak ?? 'Weak';
  const color = score >= 4 ? authPalette.accent : score >= 3 ? authPalette.brand : score >= 2 ? authPalette.warning : authPalette.danger;

  return (
    <View style={[styles.strengthWrap, isRTL && styles.rowReverse]}>
      <View style={[styles.strengthBars, isRTL && styles.rowReverse]}>
        {[1, 2, 3, 4].map(item => (
          <View key={item} style={[styles.strengthBar, item <= score && { backgroundColor: color }]} />
        ))}
      </View>
      <Text style={[styles.strengthText, { color }]}>{label}</Text>
    </View>
  );
}

export function SuccessMark({ active }: { active: boolean }) {
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!active) return;
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 110,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Animated.View style={[styles.successMark, { transform: [{ scale }] }]}>
      <Ionicons name="checkmark" size={38} color={authPalette.textInverse} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authPalette.bg },
  scrollContent: { flexGrow: 1, padding: 20, paddingTop: 64, paddingBottom: 32 },
  scrollCentered: { justifyContent: 'center' },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  topAccessory: { marginBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  rowReverse: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right' },
  logoMark: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authPalette.primary,
    shadowColor: '#101828',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  brandText: { color: authPalette.ink, fontSize: 19, fontWeight: '800', letterSpacing: 0 },
  brandSubtext: { color: authPalette.muted, fontSize: 12, fontWeight: '600', marginTop: 1 },
  heroCopy: { marginBottom: 18 },
  eyebrow: { color: authPalette.brand, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  title: { color: authPalette.ink, fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: 0 },
  subtitle: { color: authPalette.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  card: {
    backgroundColor: authPalette.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAECF0',
    gap: 16,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  footer: { marginTop: 18, alignItems: 'center' },
  inputBlock: { gap: 7 },
  label: { color: authPalette.ink, fontSize: 13, fontWeight: '800' },
  inputWrap: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: authPalette.line,
    backgroundColor: '#FCFCFD',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrapError: { borderColor: authPalette.danger, backgroundColor: '#FFFBFA' },
  input: { flex: 1, color: authPalette.ink, fontSize: 16, minHeight: 50, paddingVertical: 10 },
  helperText: { color: authPalette.muted, fontSize: 12, lineHeight: 16 },
  errorText: { color: authPalette.danger, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  authButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: authPalette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#101828',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  authButtonSecondary: { backgroundColor: authPalette.surface, borderWidth: 1, borderColor: authPalette.line, shadowOpacity: 0, elevation: 0 },
  authButtonGhost: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0, minHeight: 42 },
  authButtonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.82 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  authButtonText: { fontSize: 16, fontWeight: '900' },
  textAction: { color: authPalette.brand, fontSize: 14, fontWeight: '800' },
  banner: { borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bannerCopy: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 13, fontWeight: '900' },
  bannerMessage: { color: authPalette.muted, fontSize: 12, lineHeight: 17 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: authPalette.lineStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: authPalette.primary, borderColor: authPalette.primary },
  checkLabel: { flex: 1, color: authPalette.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  roleOption: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authPalette.line,
    backgroundColor: '#FCFCFD',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleOptionSelected: { borderColor: authPalette.brand, backgroundColor: authPalette.soft },
  roleIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: authPalette.soft, alignItems: 'center', justifyContent: 'center' },
  roleIconSelected: { backgroundColor: authPalette.brand },
  roleCopy: { flex: 1, gap: 3 },
  roleTitle: { color: authPalette.ink, fontSize: 15, fontWeight: '900' },
  roleDescription: { color: authPalette.muted, fontSize: 12, lineHeight: 17 },
  stepWrap: { gap: 8 },
  stepText: { color: authPalette.muted, fontSize: 12, fontWeight: '800' },
  stepRail: { flexDirection: 'row', gap: 7 },
  stepDot: { flex: 1, height: 5, borderRadius: 999, backgroundColor: '#EAECF0' },
  stepDotActive: { backgroundColor: authPalette.primary },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 5 },
  strengthBar: { flex: 1, height: 5, borderRadius: 999, backgroundColor: '#EAECF0' },
  strengthText: { fontSize: 12, fontWeight: '900' },
  successMark: { width: 76, height: 76, borderRadius: 38, backgroundColor: authPalette.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});

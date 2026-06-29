import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import {
  AuthBanner,
  AuthButton,
  AuthInput,
  AuthScaffold,
  CheckRow,
  TextAction,
  authPalette,
} from '@/components/auth';
import { LanguageSelector } from '@/components/language/LanguageSelector';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { RootStackParamList } from '@/types';
import { isEmail } from '@/utils/validators';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

function friendlyLoginError(message: string, t: ReturnType<typeof useLanguage>['t']) {
  const lower = message.toLowerCase();
  if (lower.includes('timeout') || lower.includes('waking') || lower.includes('network')) {
    return t('auth.loginSlow');
  }
  if (lower.includes('invalid') || lower.includes('wrong') || lower.includes('password')) {
    return t('auth.loginWrong');
  }
  return message || t('auth.loginGeneric');
}

export default function LoginScreen({ navigation }: Props) {
  const { t, isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const { login } = useAuth();
  const cleanEmail = email.trim().toLowerCase();

  const emailError = useMemo(() => {
    if (!touched.email && email.length === 0) return '';
    return isEmail(cleanEmail) ? '' : t('auth.validEmail');
  }, [cleanEmail, email.length, t, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password && password.length === 0) return '';
    return password.length > 0 ? '' : t('auth.enterPassword');
  }, [password, t, touched.password]);

  const canSubmit = isEmail(cleanEmail) && password.length > 0;

  const handleLogin = () => {
    setTouched({ email: true, password: true });
    setInfo('');
    setError('');

    if (!canSubmit) return;

    login.mutate(
      { email: cleanEmail, password },
      {
        onError: err => setError(friendlyLoginError(err.message, t)),
      },
    );
  };

  return (
    <AuthScaffold
      topAccessory={<LanguageSelector />}
      eyebrow={t('auth.welcomeBack')}
      title={t('auth.signInTitle')}
      subtitle={t('auth.signInSubtitle')}
      footer={
        <View style={[styles.footerRow, isRTL && styles.rowReverse]}>
          <Text style={styles.footerText}>{t('auth.newHere')}</Text>
          <TextAction text={t('auth.createAccount')} onPress={() => navigation.navigate('Register')} />
        </View>
      }
    >
      {error ? <AuthBanner tone="danger" title={t('auth.loginFailed')} message={error} /> : null}
      {info ? <AuthBanner tone="info" title={t('auth.biometricTitle')} message={info} /> : null}

      <AuthInput
        label={t('auth.email')}
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setError('');
        }}
        onBlur={() => setTouched(current => ({ ...current, email: true }))}
        keyboardType="email-address"
        textContentType="emailAddress"
        leftIcon="mail-outline"
        error={emailError}
      />

      <AuthInput
        label={t('auth.password')}
        placeholder={t('auth.passwordPlaceholder')}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError('');
        }}
        onBlur={() => setTouched(current => ({ ...current, password: true }))}
        secureTextEntry={!showPassword}
        textContentType="password"
        leftIcon="lock-closed-outline"
        rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
        onRightPress={() => setShowPassword(current => !current)}
        error={passwordError}
      />

      <View style={[styles.actionsRow, isRTL && styles.rowReverse]}>
        <View style={styles.rememberWrap}>
          <CheckRow checked={rememberMe} label={t('auth.keepSignedIn')} onPress={() => setRememberMe(current => !current)} />
        </View>
        <TextAction text={t('auth.forgot')} onPress={() => navigation.navigate('ForgotPassword')} />
      </View>

      <AuthButton
        title={t('auth.signIn')}
        icon="arrow-forward"
        loading={login.isPending}
        disabled={!canSubmit}
        onPress={handleLogin}
      />

      <AuthButton
        title={t('auth.biometric')}
        icon="finger-print-outline"
        variant="secondary"
        onPress={() => setInfo(t('auth.biometricMessage'))}
      />

      <View style={styles.demoStrip}>
        <Ionicons name="shield-checkmark-outline" size={17} color={authPalette.accent} />
        <Text style={styles.demoText}>{t('auth.secureSession')}</Text>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowReverse: { flexDirection: 'row-reverse' },
  rememberWrap: { flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  footerText: { color: authPalette.muted, fontSize: 14, fontWeight: '700' },
  demoStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingTop: 2 },
  demoText: { color: authPalette.muted, fontSize: 12, fontWeight: '700' },
});

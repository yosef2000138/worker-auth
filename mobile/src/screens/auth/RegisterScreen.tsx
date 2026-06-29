import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AuthBanner,
  AuthButton,
  AuthInput,
  AuthScaffold,
  CheckRow,
  PasswordStrength,
  RoleOption,
  StepIndicator,
  SuccessMark,
  TextAction,
  authPalette,
} from '@/components/auth';
import { LanguageSelector } from '@/components/language/LanguageSelector';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { Role, RootStackParamList } from '@/types';
import { isEmail } from '@/utils/validators';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;
type RoleChoice = Exclude<Role, 'ADMIN'>;
type FieldName = 'fullName' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'terms';

const PHONE_REGEX = /^(\+?[1-9]\d{7,14}|0\d{8,14})$/;

function passwordScore(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function friendlyRegisterError(message: string, t: ReturnType<typeof useLanguage>['t']) {
  const lower = message.toLowerCase();
  if (lower.includes('timeout') || lower.includes('waking') || lower.includes('network')) {
    return t('register.slow');
  }
  if (lower.includes('already') || lower.includes('exists') || lower.includes('unique')) {
    return t('register.exists');
  }
  return message || t('register.generic');
}

export default function RegisterScreen({ navigation }: Props) {
  const { t, isRTL } = useLanguage();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<RoleChoice>('CUSTOMER');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    fullName: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
    terms: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register } = useAuth();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();
  const strength = useMemo(() => passwordScore(password), [password]);
  const passwordValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const shouldShow = (field: FieldName) => submitted || touched[field];

  const fullNameError = shouldShow('fullName') && fullName.trim().length < 2 ? t('register.nameError') : '';
  const emailError = shouldShow('email') && !isEmail(cleanEmail) ? t('auth.validEmail') : '';
  const phoneError = shouldShow('phone') && cleanPhone.length > 0 && !PHONE_REGEX.test(cleanPhone)
    ? t('register.phoneError')
    : '';
  const passwordError = shouldShow('password') && (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password))
    ? t('register.passwordError')
    : '';
  const confirmError = shouldShow('confirmPassword') && confirmPassword !== password ? t('register.confirmError') : '';
  const termsError = shouldShow('terms') && !acceptedTerms ? t('register.termsError') : '';

  const detailsValid = fullName.trim().length >= 2 && isEmail(cleanEmail) && (!cleanPhone || PHONE_REGEX.test(cleanPhone));
  const securityValid = passwordValid && confirmPassword === password && acceptedTerms;
  const canContinue = step === 1 || (step === 2 ? detailsValid : securityValid);

  const touch = (field: FieldName) => setTouched(current => ({ ...current, [field]: true }));

  const goNext = () => {
    setSubmitted(true);
    if (!canContinue) return;
    setSubmitted(false);
    setStep(current => Math.min(3, current + 1));
  };

  const goBack = () => {
    if (step === 1) {
      navigation.goBack();
      return;
    }
    setSubmitted(false);
    setStep(current => Math.max(1, current - 1));
  };

  const handleRegister = () => {
    setSubmitted(true);
    if (!securityValid || !detailsValid) return;

    register.mutate(
      {
        fullName: fullName.trim(),
        email: cleanEmail,
        phone: cleanPhone || undefined,
        password,
        role,
      },
      {
        onSuccess: () => {
          setCreated(true);
          successTimer.current = setTimeout(() => navigation.replace('Login'), 1250);
        },
      },
    );
  };

  if (created) {
    return (
      <AuthScaffold
        centered
        topAccessory={<LanguageSelector />}
        eyebrow={t('register.ready')}
        title={t('register.created')}
        subtitle={t('register.createdSubtitle')}
      >
        <SuccessMark active={created} />
        <AuthBanner tone="success" title={t('register.success')} message={t('register.returnLogin')} />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      topAccessory={<LanguageSelector />}
      eyebrow={t('register.getStarted')}
      title={t('register.title')}
      subtitle={step === 1 ? t('register.step1Subtitle') : step === 2 ? t('register.step2Subtitle') : t('register.step3Subtitle')}
      footer={
        <View style={[styles.footerRow, isRTL && styles.rowReverse]}>
          <Text style={styles.footerText}>{t('register.alreadyHave')}</Text>
          <TextAction text={t('auth.signIn')} onPress={() => navigation.navigate('Login')} />
        </View>
      }
    >
      <StepIndicator step={step} total={3} label={t('register.stepOf', { step, total: 3 })} />

      {register.isError ? (
        <AuthBanner tone="danger" title={t('register.failed')} message={friendlyRegisterError(register.error.message, t)} />
      ) : null}

      {step === 1 ? (
        <View style={styles.stepBody}>
          <RoleOption
            selected={role === 'CUSTOMER'}
            icon="home-outline"
            title={t('common.customer')}
            description={t('register.customerDescription')}
            onPress={() => setRole('CUSTOMER')}
          />
          <RoleOption
            selected={role === 'WORKER'}
            icon="construct-outline"
            title={t('common.workerRole')}
            description={t('register.workerDescription')}
            onPress={() => setRole('WORKER')}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.stepBody}>
          <AuthInput
            label={t('register.fullName')}
            placeholder={t('register.fullNamePlaceholder')}
            value={fullName}
            onChangeText={setFullName}
            onBlur={() => touch('fullName')}
            autoCapitalize="words"
            textContentType="name"
            leftIcon="person-outline"
            error={fullNameError}
          />
          <AuthInput
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            onBlur={() => touch('email')}
            keyboardType="email-address"
            textContentType="emailAddress"
            leftIcon="mail-outline"
            error={emailError}
          />
          <AuthInput
            label={t('register.phone')}
            placeholder={t('register.phonePlaceholder')}
            value={phone}
            onChangeText={setPhone}
            onBlur={() => touch('phone')}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            leftIcon="call-outline"
            helper={t('register.phoneHelper')}
            error={phoneError}
          />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.stepBody}>
          <AuthInput
            label={t('auth.password')}
            placeholder={t('register.createPassword')}
            value={password}
            onChangeText={setPassword}
            onBlur={() => touch('password')}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightPress={() => setShowPassword(current => !current)}
            error={passwordError}
          />
          <PasswordStrength
            score={strength}
            labels={{
              strong: t('password.strong'),
              good: t('password.good'),
              fair: t('password.fair'),
              weak: t('password.weak'),
            }}
          />
          <AuthInput
            label={t('register.confirmPassword')}
            placeholder={t('register.repeatPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onBlur={() => touch('confirmPassword')}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            leftIcon="shield-checkmark-outline"
            error={confirmError}
          />
          <View>
            <CheckRow
              checked={acceptedTerms}
              label={t('register.terms')}
              onPress={() => {
                touch('terms');
                setAcceptedTerms(current => !current);
              }}
            />
            {termsError ? <Text style={styles.inlineError}>{termsError}</Text> : null}
          </View>
        </View>
      ) : null}

      <View style={[styles.buttonRow, isRTL && styles.rowReverse]}>
        <AuthButton title={t('register.back')} variant="secondary" onPress={goBack} style={styles.buttonHalf} />
        {step < 3 ? (
          <AuthButton title={t('register.continue')} icon="arrow-forward" disabled={!canContinue} onPress={goNext} style={styles.buttonHalf} />
        ) : (
          <AuthButton title={t('register.submit')} icon="checkmark" loading={register.isPending} disabled={!canContinue} onPress={handleRegister} style={styles.buttonHalf} />
        )}
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  stepBody: { gap: 14 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  rowReverse: { flexDirection: 'row-reverse' },
  buttonHalf: { flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  footerText: { color: authPalette.muted, fontSize: 14, fontWeight: '700' },
  inlineError: { color: authPalette.danger, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 6, marginLeft: 32 },
});

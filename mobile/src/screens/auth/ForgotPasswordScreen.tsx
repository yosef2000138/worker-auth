import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthBanner, AuthButton, AuthInput, AuthScaffold, TextAction, authPalette } from '@/components/auth';
import { useLanguage } from '@/i18n';
import { authService } from '@/services/authService';
import { RootStackParamList } from '@/types';
import { isEmail } from '@/utils/validators';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

function friendlyResetError(message: string, t: ReturnType<typeof useLanguage>['t']) {
  const lower = message.toLowerCase();
  if (lower.includes('timeout') || lower.includes('network')) {
    return t('forgot.slow');
  }
  return message || t('forgot.generic');
}

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const cleanEmail = email.trim().toLowerCase();
  const emailError = useMemo(() => {
    if (!touched && email.length === 0) return '';
    return isEmail(cleanEmail) ? '' : t('auth.validEmail');
  }, [cleanEmail, email.length, t, touched]);

  const mutation = useMutation({ mutationFn: () => authService.forgotPassword(cleanEmail) });
  const canSubmit = isEmail(cleanEmail);

  const handleSend = () => {
    setTouched(true);
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <AuthScaffold
      eyebrow={t('forgot.eyebrow')}
      title={t('forgot.title')}
      subtitle={t('forgot.subtitle')}
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t('forgot.remembered')}</Text>
          <TextAction text={t('forgot.backToSignIn')} onPress={() => navigation.navigate('Login')} />
        </View>
      }
    >
      {mutation.isSuccess ? (
        <AuthBanner tone="success" title={t('forgot.emailSentTitle')} message={t('forgot.emailSentMessage')} />
      ) : null}
      {mutation.isError ? (
        <AuthBanner tone="danger" title={t('forgot.failedTitle')} message={friendlyResetError(mutation.error.message, t)} />
      ) : null}

      <AuthInput
        label={t('auth.email')}
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          mutation.reset();
        }}
        onBlur={() => setTouched(true)}
        keyboardType="email-address"
        textContentType="emailAddress"
        leftIcon="mail-outline"
        error={emailError}
      />

      <AuthButton
        title={t('forgot.send')}
        icon="send-outline"
        loading={mutation.isPending}
        disabled={!canSubmit}
        onPress={handleSend}
      />

      <AuthButton title={t('common.back')} variant="secondary" onPress={() => navigation.goBack()} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  footerText: { color: authPalette.muted, fontSize: 14, fontWeight: '700' },
});

import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Banner, Body, BodySm, Button, Card, H2, H3, Row, Stack } from '@/components/ui';
import { useLanguage, type TranslationKey } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@worker.app';

function mailto(email: string, subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function SupportScreen() {
  const { t } = useLanguage();
  const user = useAuthStore(s => s.user);
  const [message, setMessage] = useState<string | null>(null);

  const supportBody = useMemo(() => [
    t('support.emailBodyIntro'),
    '',
    `User ID: ${user?.id ?? 'unknown'}`,
    `Role: ${user?.role ?? 'unknown'}`,
    `Email: ${user?.email ?? 'unknown'}`,
  ].join('\n'), [t, user?.email, user?.id, user?.role]);

  const openMail = async (subjectKey: TranslationKey) => {
    setMessage(null);
    const url = mailto(SUPPORT_EMAIL, t(subjectKey), supportBody);
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      setMessage(t('support.emailUnavailable'));
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack gap={spacing.xs}>
        <H2>{t('support.title')}</H2>
        <Body color={colors.textSecondary}>{t('support.subtitle')}</Body>
      </Stack>

      {message ? <Banner tone="warning" message={message} /> : null}

      <Card>
        <Stack gap={spacing.md}>
          <Row gap={spacing.sm} align="center">
            <Ionicons name="mail-outline" size={22} color={colors.primary} />
            <H3>{t('support.contactTitle')}</H3>
          </Row>
          <BodySm color={colors.textSecondary}>{SUPPORT_EMAIL}</BodySm>
          <Button
            title={t('support.emailSupport')}
            icon={<Ionicons name="mail-outline" size={18} color={colors.textInverse} />}
            onPress={() => { void openMail('support.emailSubject'); }}
          />
          <Button
            title={t('support.reportProblem')}
            variant="outline"
            icon={<Ionicons name="bug-outline" size={18} color={colors.textPrimary} />}
            onPress={() => { void openMail('support.reportSubject'); }}
          />
        </Stack>
      </Card>

      <Card>
        <Stack gap={spacing.sm}>
          <Row gap={spacing.sm} align="center">
            <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
            <H3>{t('support.faqTitle')}</H3>
          </Row>
          <Body color={colors.textSecondary}>{t('support.faqBody')}</Body>
          <Button title={t('support.faqButton')} variant="ghost" disabled />
        </Stack>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.lg },
});

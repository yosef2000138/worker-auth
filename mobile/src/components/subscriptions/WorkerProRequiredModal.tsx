import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySm, Button, H3, Row, Stack } from '@/components/ui';
import type { WorkerAcceptanceAccess } from '@/types';
import { getWorkerProPrice } from '@/features/subscriptions';
import { useLanguage } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

type Props = {
  visible: boolean;
  access?: WorkerAcceptanceAccess;
  storeLocalizedPrice?: string | null;
  onClose: () => void;
  onViewWorkerPro: () => void;
};

export function WorkerProRequiredModal({
  visible,
  access,
  storeLocalizedPrice,
  onClose,
  onViewWorkerPro,
}: Props) {
  const { t, locale } = useLanguage();
  const used = access?.freeRequestsUsed ?? access?.acceptedRequestCount ?? 5;
  const limit = access?.freeRequestLimit ?? access?.freeAcceptedRequestLimit ?? 5;
  const remaining = access?.freeRequestsRemaining ?? access?.remainingFreeRequests ?? 0;
  const price = t('subscription.price.monthly', {
    price: getWorkerProPrice(locale, storeLocalizedPrice),
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <Stack gap={spacing.lg}>
            <Row justify="space-between" align="flex-start">
              <View style={styles.iconWrap} accessible accessibilityLabel={t('subscription.paywall.iconLabel')}>
                <Ionicons name="shield-checkmark-outline" size={32} color={colors.brand} />
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </Row>

            <Stack gap={spacing.sm}>
              <H3>{t('subscription.paywall.title')}</H3>
              <Body color={colors.textSecondary}>{t('subscription.paywall.message')}</Body>
            </Stack>

            <View style={styles.usageBox}>
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('subscription.freeUsed')}</BodySm>
                <BodySm weight="bold">{t('subscription.freeUsedValue', { used, limit })}</BodySm>
              </Row>
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('subscription.freeRemaining')}</BodySm>
                <BodySm weight="bold">{remaining}</BodySm>
              </Row>
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('subscription.planPrice')}</BodySm>
                <BodySm weight="bold">{price}</BodySm>
              </Row>
            </View>

            <BodySm color={colors.textSecondary}>{t('subscription.paywall.existingJobs')}</BodySm>

            <Stack gap={spacing.sm}>
              <Button
                title={t('subscription.paywall.viewWorkerPro')}
                onPress={onViewWorkerPro}
                icon={<Ionicons name="card-outline" size={18} color={colors.textInverse} />}
                accessibilityLabel={t('subscription.paywall.viewWorkerPro')}
              />
              <Button
                title={t('subscription.paywall.notNow')}
                variant="outline"
                onPress={onClose}
                accessibilityLabel={t('subscription.paywall.notNow')}
              />
            </Stack>
          </Stack>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    padding: spacing.lg,
  },
  sheet: {
    maxHeight: '88%',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetContent: {
    padding: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoftest,
  },
  usageBox: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
});

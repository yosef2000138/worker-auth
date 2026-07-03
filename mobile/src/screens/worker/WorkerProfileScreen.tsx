import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LanguageSelector } from '@/components/language/LanguageSelector';
import { workerService } from '@/services/workerService';
import { userService } from '@/services/userService';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { backendSubscriptionQueryKey, subscriptionApi } from '@/features/subscriptions';
import {
  Stack, Row, Card, Avatar, Button, Field, H2, H3,
  Body, BodySm, Banner, ErrorState, ListSkeleton,
} from '@/components/ui';
import { RatingStars } from '@/components/ui/Rating';
import { colors, spacing } from '@/theme';
import { isWorkerProfileComplete, workerProfileMissingItemKeys } from '@/utils/workerProfile';
import { RootStackParamList } from '@/types';
import { queryKeys } from '@/utils/queryKeys';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WorkerOwnProfileScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: worker, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.workerMe(user?.id),
    queryFn: workerService.me,
    enabled: Boolean(user?.id),
    retry: false,
  });
  const subscriptionQuery = useQuery({
    queryKey: backendSubscriptionQueryKey(user?.id),
    queryFn: subscriptionApi.me,
    enabled: Boolean(user?.id),
    retry: 1,
  });

  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [yearsExp, setYearsExp] = useState('');
  const [workerEditMode, setWorkerEditMode] = useState(false);
  const [personalEditMode, setPersonalEditMode] = useState(false);

  useEffect(() => {
    if (worker) {
      setBio(worker.bio ?? '');
      setHourlyRate(worker.hourlyRate != null ? String(worker.hourlyRate) : '');
      setYearsExp(worker.yearsExp != null ? String(worker.yearsExp) : '');
    }
  }, [worker]);

  const saveProfile = useMutation({
    mutationFn: () => {
      const nextRate = hourlyRate.trim() ? Number(hourlyRate) : null;
      const nextYears = yearsExp.trim() ? Number.parseInt(yearsExp, 10) : undefined;

      if (nextRate != null && (!Number.isFinite(nextRate) || nextRate <= 0)) {
        throw new Error(t('validation.hourlyRatePositive'));
      }
      if (nextYears != null && (!Number.isFinite(nextYears) || nextYears < 0)) {
        throw new Error(t('validation.experienceRange'));
      }

      return workerService.updateMe({
        bio: bio.trim() || null,
        hourlyRate: nextRate,
        yearsExp: nextYears,
      });
    },
    onSuccess: () => {
      setWorkerEditMode(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.workerMe(user?.id) });
    },
  });

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');

  useEffect(() => {
    setFullName(worker?.user?.fullName ?? user?.fullName ?? '');
    setPhone(worker?.user?.phone ?? user?.phone ?? '');
    setAvatarUrl(worker?.user?.avatarUrl ?? user?.avatarUrl ?? '');
  }, [user?.avatarUrl, user?.fullName, user?.phone, worker?.user?.avatarUrl, worker?.user?.fullName, worker?.user?.phone]);

  const updateUser = useMutation({
    mutationFn: () =>
      userService.updateProfile({ fullName: fullName.trim(), phone: phone.trim() || null, avatarUrl: avatarUrl.trim() || null }),
    onSuccess: (updated) => {
      setUser(updated);
      setPersonalEditMode(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.workerMe(user?.id) });
    },
  });

  const handleLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  if (isLoading) return <ScrollView style={{ padding: spacing.lg }}><ListSkeleton count={3} /></ScrollView>;
  if (isError) return <ErrorState onRetry={refetch} />;

  const profileUser = worker?.user ?? user;
  const missingItems = workerProfileMissingItemKeys(worker);
  const complete = isWorkerProfileComplete(worker);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
        <Avatar uri={profileUser?.avatarUrl} name={profileUser?.fullName} size={80} />
        <H2 style={{ marginTop: spacing.md, textAlign: 'center' }}>{profileUser?.fullName}</H2>
        <BodySm color={colors.textSecondary}>{profileUser?.email}</BodySm>
        {worker?.ratingAvg != null ? (
          <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
            <RatingStars rating={worker.ratingAvg} count={worker.totalReviews ?? worker.ratingCount ?? 0} />
          </Row>
        ) : null}
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <LanguageSelector variant="row" />
      </Card>

      {!complete ? (
        <Card style={{ marginTop: spacing.md }}>
          <Stack gap={spacing.sm}>
            <H3>{t('profile.setupChecklist')}</H3>
            <Body color={colors.textSecondary}>{t('profile.setupChecklistMessage')}</Body>
            {missingItems.map(item => <BodySm key={item} color={colors.danger}>- {t(item)}</BodySm>)}
          </Stack>
        </Card>
      ) : null}

      {/* Worker details */}
      <Card style={{ marginTop: spacing.md }}>
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <H3>{t('profile.workerProfile')}</H3>
          <Button title={workerEditMode ? t('profile.cancel') : t('profile.edit')} variant="ghost" size="sm" fullWidth={false} onPress={() => setWorkerEditMode(e => !e)} />
        </Row>
        {saveProfile.isError ? <Banner tone="danger" message={t('profile.saveFailed')} /> : null}
        {saveProfile.isSuccess ? <Banner tone="success" message={t('profile.updated')} /> : null}
        <Stack gap={spacing.md}>
          <Field label={t('profile.bio')} placeholder={t('profile.bioPlaceholder')} value={bio} onChangeText={setBio} multiline editable={workerEditMode} />
          <Row gap={spacing.md}>
            <Field label={t('profile.hourlyRate')} placeholder="80" value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" editable={workerEditMode} containerStyle={{ flex: 1 }} />
            <Field label={t('profile.experience')} placeholder="5" value={yearsExp} onChangeText={setYearsExp} keyboardType="numeric" editable={workerEditMode} containerStyle={{ flex: 1 }} />
          </Row>
        </Stack>
        {workerEditMode ? <Button title={t('profile.saveWorker')} loading={saveProfile.isPending} style={{ marginTop: spacing.lg }} onPress={() => saveProfile.mutate()} /> : null}
      </Card>

      {/* Personal info */}
      <Card style={{ marginTop: spacing.md }}>
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <H3>{t('profile.personalInfo')}</H3>
          <Button title={personalEditMode ? t('profile.cancel') : t('profile.edit')} variant="ghost" size="sm" fullWidth={false} onPress={() => setPersonalEditMode(e => !e)} />
        </Row>
        {updateUser.isError ? <Banner tone="danger" message={t('profile.saveFailed')} /> : null}
        {updateUser.isSuccess ? <Banner tone="success" message={t('profile.saved')} /> : null}
        <Stack gap={spacing.md}>
          <Field label={t('register.fullName')} value={fullName} onChangeText={setFullName} editable={personalEditMode} />
          <Field label={t('register.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={personalEditMode} />
          <Field label={t('profile.avatarUrl')} value={avatarUrl} onChangeText={setAvatarUrl} keyboardType="url" editable={personalEditMode} />
        </Stack>
        {personalEditMode ? <Button title={t('profile.savePersonal')} loading={updateUser.isPending} variant="outline" style={{ marginTop: spacing.lg }} onPress={() => updateUser.mutate()} /> : null}
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Stack gap={spacing.sm}>
          <H3>{t('profile.subscriptionBilling')}</H3>
          <Body color={colors.textSecondary}>
            {subscriptionQuery.data?.hasAccess
              ? `${t('subscription.title')} - ${t('common.active')}`
              : subscriptionQuery.data
              ? `${t('subscription.title')} - ${subscriptionQuery.data.status}.`
              : t('subscription.message.backendUnavailable')}
          </Body>
          <Button title={t('profile.openWorkerPro')} variant="outline" onPress={() => navigation.navigate('Subscription')} />
        </Stack>
      </Card>

      {/* Logout */}
      <Card style={{ marginTop: spacing.md }}>
        <Button title={t('profile.logout')} variant="danger" onPress={handleLogout} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
});

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LanguageSelector } from '@/components/language/LanguageSelector';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { userService } from '@/services/userService';
import { useAuthStore } from '@/store/authStore';
import {
  Stack, Row, Card, Avatar, Button, Field, Banner,
  H2, H3, Body, BodySm, Divider,
} from '@/components/ui';
import { colors, spacing } from '@/theme';
import { localizedApiErrorMessage } from '@/utils/localizedErrors';
import { queryKeys } from '@/utils/queryKeys';

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const setUser = useAuthStore(s => s.setUser);
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [editMode, setEditMode] = useState(false);

  const updateProfile = useMutation({
    mutationFn: () => userService.updateProfile({ fullName: fullName.trim(), phone: phone.trim() || null }),
    onSuccess: (updated) => {
      setUser(updated);
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(user?.id) });
    },
  });

  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const changePwd = useMutation({
    mutationFn: () => userService.changePassword({ currentPassword: curPwd, newPassword: newPwd }),
    onSuccess: () => {
      setCurPwd('');
      setNewPwd('');
      setShowPwd(false);
      Alert.alert(t('profile.passwordChanged'), t('profile.passwordChangedBody'));
    },
  });

  const handleLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Avatar + name */}
      <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
        <Avatar uri={user?.avatarUrl} name={user?.fullName} size={80} />
        <H2 style={{ marginTop: spacing.md, textAlign: 'center' }}>{user?.fullName}</H2>
        <BodySm color={colors.textSecondary}>{user?.email}</BodySm>
        {user?.isEmailVerified === false ? <BodySm color={colors.danger} style={{ marginTop: 4 }}>{t('profile.emailNotVerified')}</BodySm> : null}
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <LanguageSelector variant="row" />
      </Card>

      {/* Edit profile */}
      <Card style={{ marginTop: spacing.md }}>
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <H3>{t('profile.personalInfo')}</H3>
          <Button title={editMode ? t('profile.cancel') : t('profile.edit')} variant="ghost" size="sm" fullWidth={false} onPress={() => { setEditMode(e => !e); setFullName(user?.fullName ?? ''); setPhone(user?.phone ?? ''); }} />
        </Row>

        {updateProfile.isError ? <Banner tone="danger" message={localizedApiErrorMessage(updateProfile.error, t, 'profile.couldNotSave')} /> : null}
        {updateProfile.isSuccess ? <Banner tone="success" message={t('profile.updated')} /> : null}

        <Stack gap={spacing.md}>
          <Field label={t('register.fullName')} value={fullName} onChangeText={setFullName} editable={editMode} />
          <Field label={t('auth.email')} value={user?.email ?? ''} editable={false} />
          <Field label={t('register.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={editMode} />
        </Stack>

        {editMode ? (
          <Button
            title={t('profile.saveChanges')}
            loading={updateProfile.isPending}
            style={{ marginTop: spacing.lg }}
            onPress={() => updateProfile.mutate()}
          />
        ) : null}
      </Card>

      {/* Change password */}
      <Card style={{ marginTop: spacing.md }}>
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <H3>{t('profile.changePassword')}</H3>
          <Button title={showPwd ? t('profile.cancel') : t('profile.change')} variant="ghost" size="sm" fullWidth={false} onPress={() => { setShowPwd(s => !s); setCurPwd(''); setNewPwd(''); }} />
        </Row>

        {showPwd ? (
          <Stack gap={spacing.md}>
            {changePwd.isError ? <Banner tone="danger" message={localizedApiErrorMessage(changePwd.error, t, 'profile.changePasswordFailed')} /> : null}
            {changePwd.isSuccess ? <Banner tone="success" message={t('profile.passwordChangedBanner')} /> : null}
            <Field label={t('profile.currentPassword')} value={curPwd} onChangeText={setCurPwd} secureTextEntry />
            <Field label={t('profile.newPassword')} value={newPwd} onChangeText={setNewPwd} secureTextEntry helperText={t('profile.passwordHelper')} />
            <Button title={t('profile.updatePassword')} loading={changePwd.isPending} onPress={() => changePwd.mutate()} />
          </Stack>
        ) : (
          <BodySm color={colors.textSecondary}>{t('profile.changePasswordHint')}</BodySm>
        )}
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

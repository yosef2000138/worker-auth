import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import { useAuthStore } from '@/store/authStore';
import {
  Stack, Row, Card, Avatar, Button, Field, Banner,
  H2, H3, Body, BodySm, Divider,
} from '@/components/ui';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
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
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const changePwd = useMutation({
    mutationFn: () => userService.changePassword({ currentPassword: curPwd, newPassword: newPwd }),
    onSuccess: () => { setCurPwd(''); setNewPwd(''); setShowPwd(false); Alert.alert('Password changed', 'Your password has been updated.'); },
  });

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Avatar + name */}
      <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
        <Avatar uri={user?.avatarUrl} name={user?.fullName} size={80} />
        <H2 style={{ marginTop: spacing.md, textAlign: 'center' }}>{user?.fullName}</H2>
        <BodySm color={colors.textSecondary}>{user?.email}</BodySm>
        {user?.isEmailVerified === false ? <BodySm color={colors.danger} style={{ marginTop: 4 }}>Email not verified</BodySm> : null}
      </Card>

      {/* Edit profile */}
      <Card style={{ marginTop: spacing.md }}>
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <H3>Personal info</H3>
          <Button title={editMode ? 'Cancel' : 'Edit'} variant="ghost" size="sm" fullWidth={false} onPress={() => { setEditMode(e => !e); setFullName(user?.fullName ?? ''); setPhone(user?.phone ?? ''); }} />
        </Row>

        {updateProfile.isError ? <Banner tone="danger" message={updateProfile.error?.message ?? 'Could not save.'} /> : null}
        {updateProfile.isSuccess ? <Banner tone="success" message="Profile updated!" /> : null}

        <Stack gap={spacing.md}>
          <Field label="Full name" value={fullName} onChangeText={setFullName} editable={editMode} />
          <Field label="Email" value={user?.email ?? ''} editable={false} />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={editMode} />
        </Stack>

        {editMode ? (
          <Button
            title="Save changes"
            loading={updateProfile.isPending}
            style={{ marginTop: spacing.lg }}
            onPress={() => updateProfile.mutate()}
          />
        ) : null}
      </Card>

      {/* Change password */}
      <Card style={{ marginTop: spacing.md }}>
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <H3>Change password</H3>
          <Button title={showPwd ? 'Cancel' : 'Change'} variant="ghost" size="sm" fullWidth={false} onPress={() => { setShowPwd(s => !s); setCurPwd(''); setNewPwd(''); }} />
        </Row>

        {showPwd ? (
          <Stack gap={spacing.md}>
            {changePwd.isError ? <Banner tone="danger" message={changePwd.error?.message ?? 'Could not change password.'} /> : null}
            {changePwd.isSuccess ? <Banner tone="success" message="Password changed!" /> : null}
            <Field label="Current password" value={curPwd} onChangeText={setCurPwd} secureTextEntry />
            <Field label="New password" value={newPwd} onChangeText={setNewPwd} secureTextEntry helperText="8+ characters, one uppercase, one number" />
            <Button title="Update password" loading={changePwd.isPending} onPress={() => changePwd.mutate()} />
          </Stack>
        ) : (
          <BodySm color={colors.textSecondary}>Tap Change to update your password.</BodySm>
        )}
      </Card>

      {/* Logout */}
      <Card style={{ marginTop: spacing.md }}>
        <Button title="Log out" variant="danger" onPress={handleLogout} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
});
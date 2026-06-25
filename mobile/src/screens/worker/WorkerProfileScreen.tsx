import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workerService } from '@/services/workerService';
import { userService } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import {
  Stack, Row, Card, Avatar, Button, Field, H2, H3,
  BodySm, Banner, ErrorState, ListSkeleton,
} from '@/components/ui';
import { RatingStars } from '@/components/ui/Rating';
import { colors, spacing } from '@/theme';

export default function WorkerOwnProfileScreen() {
  const { user, logout } = useAuth();
  const setUser = useAuthStore(s => s.setUser);
  const queryClient = useQueryClient();

  const { data: worker, isLoading, isError, refetch } = useQuery({
    queryKey: ['worker-me'],
    queryFn: workerService.me,
    retry: false,
  });

  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [yearsExp, setYearsExp] = useState('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (worker) {
      setBio(worker.bio ?? '');
      setHourlyRate(worker.hourlyRate != null ? String(worker.hourlyRate) : '');
      setYearsExp(worker.yearsExp != null ? String(worker.yearsExp) : '');
    }
  }, [worker]);

  const saveProfile = useMutation({
    mutationFn: () =>
      workerService.updateMe({
        bio: bio.trim() || undefined,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        yearsExp: yearsExp ? parseInt(yearsExp, 10) : undefined,
      }),
    onSuccess: () => {
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['worker-me'] });
    },
  });

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const updateUser = useMutation({
    mutationFn: () =>
      userService.updateProfile({ fullName: fullName.trim(), phone: phone.trim() || null }),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ['worker-me'] });
    },
  });

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  if (isLoading) return <ScrollView style={{ padding: spacing.lg }}><ListSkeleton count={3} /></ScrollView>;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
        <Avatar uri={user?.avatarUrl} name={user?.fullName} size={80} />
        <H2 style={{ marginTop: spacing.spacing_md, textAlign: 'center' }}>{user?.fullName}</H2>
        <BodySm color={colors.textSecondary}>{user?.email}</BodySm>
        {worker?.ratingAvg != null ? (
          <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
            <RatingStars rating={worker.ratingAvg} count={worker.totalReviews ?? worker.ratingCount ?? 0} />
          </Row>
        ) : null}
      </Card>

      {/* Worker details */}
      <Card style={{ marginTop: spacing.md }}>
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <H3>Worker profile</H3>
          <Button title={editMode ? 'Cancel' : 'Edit'} variant="ghost" size="sm" fullWidth={false} onPress={() => setEditMode(e => !e)} />
        </Row>
        {saveProfile.isError ? <Banner tone="danger" message={saveProfile.error?.message ?? 'Could not save.'} /> : null}
        {saveProfile.isSuccess ? <Banner tone="success" message="Profile updated!" /> : null}
        <Stack gap={spacing.md}>
          <Field label="Bio" placeholder="Describe your skills…" value={bio} onChangeText={setBio} multiline editable={editMode} />
          <Row gap={spacing.md}>
            <Field label="Hourly rate (₪)" placeholder="80" value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" editable={editMode} containerStyle={{ flex: 1 }} />
            <Field label="Yrs experience" placeholder="5" value={yearsExp} onChangeText={setYearsExp} keyboardType="numeric" editable={editMode} containerStyle={{ flex: 1 }} />
          </Row>
        </Stack>
        {editMode ? <Button title="Save worker profile" loading={saveProfile.isPending} style={{ marginTop: spacing.lg }} onPress={() => saveProfile.mutate()} /> : null}
      </Card>

      {/* Personal info */}
      <Card style={{ marginTop: spacing.md }}>
        <Row justify="space-between" style={{ marginBottom: spacing.md }}>
          <H3>Personal info</H3>
          <Button title={editMode ? 'Cancel' : 'Edit'} variant="ghost" size="sm" fullWidth={false} onPress={() => setEditMode(e => !e)} />
        </Row>
        {updateUser.isError ? <Banner tone="danger" message={updateUser.error?.message ?? 'Could not save.'} /> : null}
        {updateUser.isSuccess ? <Banner tone="success" message="Saved!" /> : null}
        <Stack gap={spacing.md}>
          <Field label="Full name" value={fullName} onChangeText={setFullName} editable={editMode} />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={editMode} />
        </Stack>
        {editMode ? <Button title="Save personal info" loading={updateUser.isPending} variant="outline" style={{ marginTop: spacing.lg }} onPress={() => updateUser.mutate()} /> : null}
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
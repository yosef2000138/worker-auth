import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '@/types';
import { requestService } from '@/services/requestService';
import { workerService } from '@/services/workerService';
import { Banner, BodySm, Button, Card, Field, H2, Row, Stack } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { colors, spacing } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateRequest'>;

export default function CreateRequestScreen({ route, navigation }: Props) {
  const [categoryId, setCategoryId] = useState(route.params?.categoryId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const { location, requestLocation } = useLocation();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: workerService.categories,
  });

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === categoryId),
    [categories, categoryId],
  );

  const create = useMutation({
    mutationFn: () => requestService.create({
      categoryId,
      title: title.trim(),
      description: description.trim(),
      address: address.trim(),
      lat: location?.coords.latitude ?? 0,
      lng: location?.coords.longitude ?? 0,
      paymentMethod: 'CASH',
      images: image ? [{ uri: image.uri, name: image.fileName ?? undefined, type: image.mimeType ?? undefined }] : undefined,
    }),
    onSuccess: request => navigation.replace('RequestDetails', { requestId: request.id }),
  });

  const getValidationMessage = () => {
    if (!categoryId) return 'Choose a service category first.';
    if (title.trim().length < 5) return 'Title must be at least 5 characters.';
    if (description.trim().length < 10) return 'Description must be at least 10 characters.';
    if (address.trim().length < 5) return 'Address must be at least 5 characters.';
    return null;
  };

  const canSubmit = !getValidationMessage();

  const handleSubmit = () => {
    const message = getValidationMessage();
    if (message) {
      setSubmitError(message);
      return;
    }

    setSubmitError(null);
    create.mutate();
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled) setImage(res.assets[0]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack gap={spacing.xs}>
        <H2>Create request</H2>
        <BodySm color={colors.textSecondary}>Tell workers what you need and where to come.</BodySm>
      </Stack>

      {submitError ? <Banner tone="warning" message={submitError} /> : null}
      {create.isError ? <Banner tone="danger" message={create.error?.message ?? 'Could not create request.'} /> : null}

      <Card>
        <Stack gap={spacing.md}>
          <Field
            label="Category"
            placeholder="Select a category"
            value={selectedCategory?.name ?? categoryId}
            editable={false}
          />
          {categories.length > 0 ? (
            <Row gap={spacing.sm} wrap>
              {categories.map(category => (
                <Button
                  key={category.id}
                  title={category.name}
                  variant={category.id === categoryId ? 'primary' : 'outline'}
                  size="sm"
                  fullWidth={false}
                  onPress={() => {
                    setCategoryId(category.id);
                    setSubmitError(null);
                  }}
                />
              ))}
            </Row>
          ) : (
            <Button title="Browse categories" variant="outline" onPress={() => navigation.navigate('Categories')} />
          )}

          <Field
            label="Title"
            placeholder="Example: Fix leaking sink"
            value={title}
            onChangeText={value => {
              setTitle(value);
              setSubmitError(null);
            }}
            helperText={title.length > 0 && title.trim().length < 5 ? 'Minimum 5 characters.' : undefined}
          />
          <Field
            label="Description"
            placeholder="Describe the problem, timing, and any details."
            value={description}
            onChangeText={value => {
              setDescription(value);
              setSubmitError(null);
            }}
            helperText={description.length > 0 && description.trim().length < 10 ? 'Minimum 10 characters.' : undefined}
            multiline
            style={{ minHeight: 84, textAlignVertical: 'top' }}
          />
          <Field
            label="Address"
            placeholder="Street, city"
            value={address}
            onChangeText={value => {
              setAddress(value);
              setSubmitError(null);
            }}
            helperText={address.length > 0 && address.trim().length < 5 ? 'Minimum 5 characters.' : undefined}
          />

          <Row gap={spacing.sm}>
            <Button
              title={location ? 'Location added' : 'Use current location'}
              variant="outline"
              fullWidth={false}
              icon={<Ionicons name="locate-outline" size={16} color={colors.textPrimary} />}
              onPress={() => { void requestLocation(); }}
              style={{ flex: 1 }}
            />
            <Button
              title={image ? 'Image added' : 'Add image'}
              variant="outline"
              fullWidth={false}
              icon={<Ionicons name="image-outline" size={16} color={colors.textPrimary} />}
              onPress={pick}
              style={{ flex: 1 }}
            />
          </Row>

          {!canSubmit ? <BodySm color={colors.textSecondary}>Complete category, title, description, and address to submit.</BodySm> : null}
          <Button title="Submit request" loading={create.isPending} onPress={handleSubmit} />
        </Stack>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.lg },
});

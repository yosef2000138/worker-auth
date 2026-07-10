import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '@/types';
import { requestService } from '@/services/requestService';
import { workerService } from '@/services/workerService';
import { useAuthStore } from '@/store/authStore';
import { Banner, BodySm, Button, Card, Field, H2, Row, Stack } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { getLocalizedCategoryName, useLanguage } from '@/i18n';
import { colors, spacing } from '@/theme';
import { localizedApiErrorMessage } from '@/utils/localizedErrors';
import { getDuplicateActiveRequestInfo } from '@/utils/duplicateRequestError';
import { queryKeys } from '@/utils/queryKeys';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateRequest'>;

export default function CreateRequestScreen({ route, navigation }: Props) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [categoryId, setCategoryId] = useState(route.params?.categoryId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [showManualAddress, setShowManualAddress] = useState(false);
  const [useCurrentCoords, setUseCurrentCoords] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const { location, requestLocation } = useLocation();
  const selectedLat = useCurrentCoords ? location?.coords.latitude : undefined;
  const selectedLng = useCurrentCoords ? location?.coords.longitude : undefined;

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: workerService.categories,
  });

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === categoryId),
    [categories, categoryId],
  );
  const selectedCategoryName = selectedCategory ? getLocalizedCategoryName(selectedCategory, language.code, t) : '';

  const create = useMutation({
    mutationFn: () => requestService.create({
      categoryId,
      title: title.trim(),
      description: description.trim(),
      address: address.trim() || undefined,
      lat: selectedLat,
      lng: selectedLng,
      paymentMethod: 'CASH',
      images: image ? [{ uri: image.uri, name: image.fileName ?? undefined, type: image.mimeType ?? undefined }] : undefined,
    }),
    onSuccess: request => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.customerRequests(user.id, user.role) });
      }
      navigation.replace('RequestDetails', { requestId: request.id });
    },
    onError: (error) => {
      const duplicate = getDuplicateActiveRequestInfo(error);
      if (!duplicate) return;

      Alert.alert(
        t('requests.create.duplicateTitle'),
        t('errors.duplicateActiveRequest'),
        [
          { text: t('common.close'), style: 'cancel' },
          {
            text: t('requests.create.openExistingRequest'),
            onPress: () => navigation.navigate('RequestDetails', { requestId: duplicate.requestId }),
          },
        ],
      );
    },
  });

  const getValidationMessage = () => {
    if (!categoryId) return t('requests.create.categoryRequired');
    if (title.trim().length < 5) return t('requests.create.titleRequired');
    if (description.trim().length < 10) return t('requests.create.descriptionRequired');
    if (address.trim().length > 0 && address.trim().length < 5) return t('requests.create.addressRequired');
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

  const handleUseCurrentLocation = async () => {
    setLocationMessage(null);
    const current = await requestLocation();
    if (current) {
      setUseCurrentCoords(true);
      setSubmitError(null);
      return;
    }
    setUseCurrentCoords(false);
    setLocationMessage(t('requests.create.locationPermissionDeniedContinue'));
  };

  const handleSkipLocation = () => {
    setUseCurrentCoords(false);
    setShowManualAddress(false);
    setAddress('');
    setLocationMessage(t('requests.create.locationSkipped'));
    setSubmitError(null);
  };

  const handleClearLocation = () => {
    setUseCurrentCoords(false);
    setAddress('');
    setLocationMessage(null);
    setSubmitError(null);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack gap={spacing.xs}>
        <H2>{t('requests.create.title')}</H2>
        <BodySm color={colors.textSecondary}>{t('requests.create.subtitle')}</BodySm>
      </Stack>

      {submitError ? <Banner tone="warning" message={submitError} /> : null}
      {create.isError ? <Banner tone="danger" message={localizedApiErrorMessage(create.error, t, 'requests.create.failed')} /> : null}

      <Card>
        <Stack gap={spacing.md}>
          <Field
            label={t('requests.create.category')}
            placeholder={t('requests.create.selectCategory')}
            value={selectedCategoryName || categoryId}
            editable={false}
          />
          {categories.length > 0 ? (
            <Row gap={spacing.sm} wrap>
              {categories.map(category => (
                <Button
                  key={category.id}
                  title={getLocalizedCategoryName(category, language.code, t)}
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
            <Button title={t('requests.create.browseCategories')} variant="outline" onPress={() => navigation.navigate('Categories')} />
          )}

          <Field
            label={t('requests.create.problemTitle')}
            placeholder={t('requests.create.titlePlaceholder')}
            value={title}
            onChangeText={value => {
              setTitle(value);
              setSubmitError(null);
            }}
            helperText={title.length > 0 && title.trim().length < 5 ? t('requests.create.minimum5') : undefined}
          />
          <Field
            label={t('requests.create.description')}
            placeholder={t('requests.create.descriptionPlaceholder')}
            value={description}
            onChangeText={value => {
              setDescription(value);
              setSubmitError(null);
            }}
            helperText={description.length > 0 && description.trim().length < 10 ? t('requests.create.minimum10') : undefined}
            multiline
            style={{ minHeight: 84, textAlignVertical: 'top' }}
          />
          <Card style={styles.locationCard}>
            <Stack gap={spacing.sm}>
              <Row gap={spacing.sm} align="center">
                <Ionicons name="location-outline" size={18} color={colors.primary} />
                <BodySm weight="bold">{t('requests.create.locationOptionalTitle')}</BodySm>
              </Row>
              <BodySm color={colors.textSecondary}>{t('requests.create.locationOptionalHelper')}</BodySm>

              {showManualAddress ? (
                <Field
                  label={t('requests.create.manualAddress')}
                  placeholder={t('requests.create.addressPlaceholder')}
                  value={address}
                  onChangeText={value => {
                    setAddress(value);
                    setLocationMessage(null);
                    setSubmitError(null);
                  }}
                  helperText={address.length > 0 && address.trim().length < 5 ? t('requests.create.minimum5') : undefined}
                />
              ) : null}

              {useCurrentCoords && selectedLat != null && selectedLng != null ? (
                <BodySm color={colors.success}>{t('requests.create.currentLocationSelected')}</BodySm>
              ) : null}
              {locationMessage ? <BodySm color={colors.textSecondary}>{locationMessage}</BodySm> : null}

              <Row gap={spacing.sm} wrap>
                <Button
                  title={t('requests.create.addCurrentLocation')}
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  icon={<Ionicons name="locate-outline" size={16} color={colors.textPrimary} />}
                  onPress={() => { void handleUseCurrentLocation(); }}
                  style={styles.locationAction}
                />
                <Button
                  title={t('requests.create.enterAddressManually')}
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  icon={<Ionicons name="create-outline" size={16} color={colors.textPrimary} />}
                  onPress={() => {
                    setShowManualAddress(true);
                    setLocationMessage(null);
                  }}
                  style={styles.locationAction}
                />
                <Button
                  title={t('requests.create.skipLocation')}
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={handleSkipLocation}
                  style={styles.locationAction}
                />
                {(useCurrentCoords || address.trim()) ? (
                  <Button
                    title={t('requests.create.clearLocation')}
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={handleClearLocation}
                    style={styles.locationAction}
                  />
                ) : null}
              </Row>
            </Stack>
          </Card>

          <Row gap={spacing.sm}>
            <Button
              title={image ? t('requests.create.imageAdded') : t('requests.create.addImage')}
              variant="outline"
              fullWidth={false}
              icon={<Ionicons name="image-outline" size={16} color={colors.textPrimary} />}
              onPress={pick}
              style={{ flex: 1 }}
            />
          </Row>

          {!canSubmit ? <BodySm color={colors.textSecondary}>{t('requests.create.completeRequired')}</BodySm> : null}
          <Button title={t('requests.create.submit')} loading={create.isPending} onPress={handleSubmit} />
        </Stack>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.lg },
  locationCard: { backgroundColor: colors.brandSoftest },
  locationAction: { flexBasis: '48%', flexGrow: 1 },
});

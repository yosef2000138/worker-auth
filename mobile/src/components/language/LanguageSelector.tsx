import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LANGUAGE_OPTIONS, useLanguage } from '@/i18n';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

type Variant = 'button' | 'row';

export function LanguageSelector({ variant = 'button' }: { variant?: Variant }) {
  const [open, setOpen] = useState(false);
  const { language, isRTL, setLanguage, t } = useLanguage();
  const rowDirection = isRTL ? 'row-reverse' : 'row';
  const textAlign = isRTL ? 'right' : 'left';

  const openSelector = () => setOpen(true);
  const closeSelector = () => setOpen(false);

  const chooseLanguage = async (code: typeof language.code) => {
    await setLanguage(code);
    closeSelector();
  };

  return (
    <>
      {variant === 'row' ? (
        <Pressable
          style={[styles.profileRow, { flexDirection: rowDirection }]}
          onPress={openSelector}
          accessibilityRole="button"
          accessibilityLabel={t('language.change')}
        >
          <View style={[styles.rowLabelWrap, { flexDirection: rowDirection }]}>
            <View style={styles.rowIcon}>
              <Ionicons name="globe-outline" size={20} color={colors.brand} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowLabel, { textAlign }]}>{t('language.label')}</Text>
              <Text style={[styles.rowSubLabel, { textAlign }]}>{t('language.current')}</Text>
            </View>
          </View>
          <View style={[styles.rowValueWrap, { flexDirection: rowDirection }]}>
            <Text style={styles.rowValue}>{language.nativeName}</Text>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textTertiary} />
          </View>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.button, { flexDirection: rowDirection, alignSelf: isRTL ? 'flex-start' : 'flex-end' }]}
          onPress={openSelector}
          accessibilityRole="button"
          accessibilityLabel={t('language.change')}
        >
          <Ionicons name="globe-outline" size={17} color={colors.textPrimary} />
          <Text style={styles.buttonText}>{language.nativeName}</Text>
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={closeSelector}>
        <Pressable style={styles.backdrop} onPress={closeSelector} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={[styles.sheetHeader, { flexDirection: rowDirection }]}>
              <View style={styles.sheetTitleWrap}>
                <Text style={[styles.sheetTitle, { textAlign }]}>{t('language.choose')}</Text>
                <Text style={[styles.sheetSubtitle, { textAlign }]}>{t('language.current')}: {language.nativeName}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={closeSelector} accessibilityRole="button" accessibilityLabel={t('language.close')}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.options}>
              {LANGUAGE_OPTIONS.map(option => {
                const selected = option.code === language.code;
                return (
                  <Pressable
                    key={option.code}
                    style={[styles.optionRow, { flexDirection: rowDirection }, selected && styles.optionSelected]}
                    onPress={() => chooseLanguage(option.code)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('language.change')}: ${option.nativeName}`}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected, { textAlign }]}>{option.nativeName}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : <View style={styles.optionSpacer} />}
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.cancelButton} onPress={closeSelector} accessibilityRole="button" accessibilityLabel={t('language.cancel')}>
              <Text style={styles.cancelText}>{t('language.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  profileRow: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabelWrap: { alignItems: 'center', gap: spacing.md, flex: 1 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoftest,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowLabel: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.bold },
  rowSubLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  rowValueWrap: { alignItems: 'center', gap: spacing.xs },
  rowValue: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.42)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },
  sheetHeader: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sheetTitleWrap: { flex: 1, gap: spacing.xs },
  sheetTitle: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  sheetSubtitle: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  options: { gap: spacing.sm },
  optionRow: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoftest },
  optionText: { flex: 1, color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.bold },
  optionTextSelected: { color: colors.brand },
  optionSpacer: { width: 22, height: 22 },
  cancelButton: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  cancelText: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.bold },
});

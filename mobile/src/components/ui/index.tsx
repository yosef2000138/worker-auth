import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { RequestStatus } from '@/types';
import { compactStatus } from '@/utils/formatters';

type TextTone = keyof Pick<typeof colors, 'textPrimary' | 'textSecondary' | 'textTertiary' | 'danger' | 'success' | 'brand' | 'textInverse'>;
type AppTextProps = TextProps & {
  children: React.ReactNode;
  color?: string;
  center?: boolean;
  weight?: keyof typeof fontWeight;
};

function AppText({ children, style, color = colors.textPrimary, center, weight, ...props }: AppTextProps) {
  return (
    <Text
      style={[{ color, textAlign: center ? 'center' : undefined, fontWeight: weight ? fontWeight[weight] : undefined }, style]}
      {...props}
    >
      {children}
    </Text>
  );
}

export function Screen({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return <View style={[styles.screen, padded && styles.screenPadded]}>{children}</View>;
}

export function Stack({ children, gap = spacing.md, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Row({
  children,
  gap = spacing.sm,
  justify,
  align = 'center',
  wrap,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  justify?: ViewStyle['justifyContent'];
  align?: ViewStyle['alignItems'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ flexDirection: 'row', gap, justifyContent: justify, alignItems: align, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H2(props: AppTextProps) { return <AppText {...props} style={[styles.h2, props.style]} />; }
export function H3(props: AppTextProps) { return <AppText {...props} style={[styles.h3, props.style]} />; }
export function Title(props: AppTextProps) { return <H2 {...props} />; }
export function Body(props: AppTextProps) { return <AppText {...props} style={[styles.body, props.style]} />; }
export function BodySm(props: AppTextProps) { return <AppText {...props} style={[styles.bodySm, props.style]} />; }
export function Caption(props: AppTextProps) { return <AppText {...props} color={props.color ?? colors.textTertiary} style={[styles.caption, props.style]} />; }

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  icon,
  style,
  disabled,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  loading?: boolean;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  const textColor = isOutline || isGhost ? (isDanger ? colors.danger : colors.textPrimary) : colors.textInverse;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        fullWidth && { alignSelf: 'stretch' },
        isOutline && styles.buttonOutline,
        isGhost && styles.buttonGhost,
        isDanger && !isGhost && !isOutline && styles.buttonDanger,
        pressed && { opacity: 0.78 },
        style,
      ]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? <ActivityIndicator color={textColor} /> : (
        <Row gap={spacing.xs} justify="center">
          {icon}
          <Text style={[styles.buttonText, { color: textColor }, size === 'sm' && styles.buttonTextSm]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  helperText,
  leftIcon,
  containerStyle,
  style,
  ...props
}: TextInputProps & {
  label?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label ? <BodySm weight="semibold">{label}</BodySm> : null}
      <View style={styles.inputWrap}>
        {leftIcon ? <Ionicons name={leftIcon} size={18} color={colors.textTertiary} /> : null}
        <TextInput
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, style]}
          autoCapitalize="none"
          {...props}
        />
      </View>
      {helperText ? <Caption>{helperText}</Caption> : null}
    </View>
  );
}

export function Avatar({ uri, name, size = 44 }: { uri?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink300 }} />;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: colors.textInverse, fontWeight: fontWeight.bold }}>{initials}</Text>
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'brand' | 'success' | 'danger' }) {
  const palette = tone === 'success'
    ? { bg: colors.successSoft, fg: colors.success }
    : tone === 'brand'
    ? { bg: colors.brandSoftest, fg: colors.brand }
    : tone === 'danger'
    ? { bg: colors.dangerSoft, fg: colors.danger }
    : { bg: '#F1F5F9', fg: colors.textSecondary };
  return <Text style={[styles.badge, { backgroundColor: palette.bg, color: palette.fg }]}>{label}</Text>;
}

export function Banner({ tone = 'success', message }: { tone?: 'success' | 'danger' | 'warning'; message: string }) {
  const bg = tone === 'danger' ? colors.dangerSoft : tone === 'warning' ? colors.warningSoft : colors.successSoft;
  const fg = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.success;
  return <Text style={[styles.banner, { backgroundColor: bg, color: fg }]}>{message}</Text>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function EmptyState({
  icon = 'information-circle-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.state}>
      <Ionicons name={icon} size={44} color={colors.textTertiary} />
      <H3 center>{title}</H3>
      {message ? <BodySm center color={colors.textSecondary}>{message}</BodySm> : null}
      {actionLabel ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ onRetry, message = 'Something went wrong.' }: { onRetry?: () => void; message?: string }) {
  return <EmptyState icon="warning-outline" title={message} actionLabel={onRetry ? 'Try again' : undefined} onAction={onRetry} />;
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Stack>
      {Array.from({ length: count }).map((_, index) => <View key={index} style={styles.skeleton} />)}
    </Stack>
  );
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  const tone = status === 'COMPLETED' ? 'success' : status === 'CANCELLED' ? 'danger' : status === 'PENDING' ? 'brand' : 'neutral';
  return <Badge label={compactStatus(status)} tone={tone} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPadded: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  h2: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, lineHeight: 32 },
  h3: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, lineHeight: 24 },
  body: { fontSize: fontSize.base, lineHeight: 22 },
  bodySm: { fontSize: fontSize.sm, lineHeight: 19 },
  caption: { fontSize: fontSize.xs, lineHeight: 16 },
  button: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  buttonSm: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 34 },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonGhost: { backgroundColor: 'transparent', paddingHorizontal: spacing.sm },
  buttonDanger: { backgroundColor: colors.danger },
  buttonText: { fontWeight: fontWeight.bold, fontSize: fontSize.base },
  buttonTextSm: { fontSize: fontSize.sm },
  inputWrap: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary, paddingVertical: spacing.sm },
  avatar: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badge: { overflow: 'hidden', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  banner: { overflow: 'hidden', borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  divider: { height: 1, backgroundColor: colors.border },
  state: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  skeleton: { height: 88, borderRadius: radius.lg, backgroundColor: '#E5E7EB' },
});

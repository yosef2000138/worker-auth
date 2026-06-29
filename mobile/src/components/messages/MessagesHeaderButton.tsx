import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { UnreadBadge } from '@/components/messages/UnreadBadge';
import { useLanguage } from '@/i18n';
import { useChatStore } from '@/store/chatStore';
import { colors } from '@/theme';
import { RootStackParamList } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function badgeLabel(count: number) {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

export function MessagesHeaderButton() {
  const navigation = useNavigation<Nav>();
  const unreadCount = useChatStore(s => s.unreadCount);
  const { t } = useLanguage();
  const label = badgeLabel(unreadCount);

  return (
    <Pressable
      onPress={() => navigation.navigate('Messages')}
      accessibilityRole="button"
      accessibilityLabel={t('messages.open')}
      accessibilityHint={unreadCount > 0 ? t('messages.unread', { count: label }) : t('messages.noUnread')}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name="chatbubbles-outline" size={22} color={colors.textPrimary} />
      <UnreadBadge count={unreadCount} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

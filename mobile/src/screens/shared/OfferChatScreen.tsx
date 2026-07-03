import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Banner, Body, ErrorState, ListSkeleton } from '@/components/ui';
import { requestService } from '@/services/requestService';
import { useAuthStore } from '@/store/authStore';
import { formatAppDate, useLanguage } from '@/i18n';
import { queryKeys } from '@/utils/queryKeys';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import type { OfferMessage, RootStackParamList } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OfferChat'>;

export default function OfferChatScreen({ route }: Props) {
  const { requestId, offerId } = route.params;
  const { t, locale } = useLanguage();
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const flatRef = useRef<FlatList>(null);

  const { data: httpMessages, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.offerMessages(requestId, offerId, user?.id),
    queryFn: () => requestService.offerMessages(requestId, offerId),
    enabled: Boolean(user?.id),
    refetchInterval: 3000,
  });

  const merged = React.useMemo(() => {
    const messages = Array.isArray(httpMessages) ? httpMessages : [];
    return [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [httpMessages]);

  useEffect(() => {
    if (merged.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [merged]);

  const send = useMutation({
    mutationFn: () => requestService.sendOfferMessage(requestId, offerId, content.trim()),
    onSuccess: (message) => {
      setContent('');
      queryClient.setQueryData<OfferMessage[]>(queryKeys.offerMessages(requestId, offerId, user?.id), current => {
        const messages = current ?? [];
        if (messages.some(item => item.id === message.id)) return messages;
        return [...messages, message];
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.offerMessages(requestId, offerId, user?.id) });
      queryClient.invalidateQueries({ queryKey: ['request-offers', requestId] });
    },
  });

  const handleSend = () => {
    if (!content.trim()) return;
    send.mutate();
  };

  if (isLoading) return <View style={{ padding: spacing.lg }}><ListSkeleton count={3} /></View>;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {merged.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
          <Body color={colors.textSecondary} center style={{ marginTop: spacing.md }}>
            {t('offers.chatEmpty')}
          </Body>
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={merged}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const isOwn = item.sender?.id === user?.id;
            const prevMsg = index > 0 ? merged[index - 1] : null;
            const showAvatar = !isOwn && (!prevMsg || prevMsg.sender?.id !== item.sender?.id);
            return (
              <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
                {!isOwn ? (
                  <View style={styles.avatarSlot}>
                    {showAvatar ? <Avatar uri={item.sender?.avatarUrl} name={item.sender?.fullName} size={28} /> : null}
                  </View>
                ) : null}
                <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.bubbleTime, isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeOther]}>
                    {formatAppDate(item.createdAt, locale)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {send.isError ? (
        <Banner tone="danger" message={send.error?.message ?? t('messages.chat.sendFailed')} />
      ) : null}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={t('messages.chat.placeholder')}
          placeholderTextColor={colors.textTertiary}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={2000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <Pressable
          onPress={handleSend}
          disabled={!content.trim() || send.isPending}
          style={({ pressed }) => [styles.sendBtn, (!content.trim() || send.isPending) && styles.sendBtnDisabled, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="send" size={18} color={colors.textInverse} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'] },
  messageList: { padding: spacing.lg, paddingBottom: spacing.md },
  msgRow: { flexDirection: 'row', marginBottom: spacing.sm, alignItems: 'flex-end', gap: spacing.xs },
  msgRowOwn: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  avatarSlot: { width: 28, alignItems: 'center' },
  bubble: { maxWidth: '75%', borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: fontSize.base, lineHeight: 22 },
  bubbleTextOwn: { color: colors.textInverse },
  bubbleTextOther: { color: colors.textPrimary },
  bubbleTime: { fontSize: fontSize.xs },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  bubbleTimeOther: { color: colors.textTertiary },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.ink300 },
});

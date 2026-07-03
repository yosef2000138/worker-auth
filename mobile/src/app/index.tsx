import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import AuthStack from './AuthStack';
import CustomerStack from './CustomerStack';
import WorkerStack from './WorkerStack';
import { Button, ErrorState, ListSkeleton, Screen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import ChatScreen from '@/screens/customer/ChatScreen';
import InAppMapScreen from '@/screens/shared/InAppMapScreen';
import MessagesScreen from '@/screens/shared/MessagesScreen';
import WorkerOnboardingScreen from '@/screens/worker/WorkerOnboardingScreen';
import { requestService } from '@/services/requestService';
import { workerService } from '@/services/workerService';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { RootStackParamList } from '@/types';
import { isWorkerProfileComplete } from '@/utils/workerProfile';
import { queryKeys } from '@/utils/queryKeys';
import { useRevenueCatIdentity } from '@/features/subscriptions';
import { useLanguage } from '@/i18n';

const Stack = createNativeStackNavigator<RootStackParamList>();

function WorkerGate() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const user = useAuthStore(s => s.user);
  const [completedThisSession, setCompletedThisSession] = useState(false);
  const workerQuery = useQuery({
    queryKey: queryKeys.workerMe(user?.id),
    queryFn: workerService.me,
    enabled: Boolean(user?.id),
    retry: 1,
  });

  if (workerQuery.isLoading) {
    return (
      <Screen>
        <ListSkeleton count={4} />
      </Screen>
    );
  }

  if (workerQuery.isError) {
    const message = workerQuery.error instanceof Error ? workerQuery.error.message : t('worker.gate.profileLoadFailed');
    const friendlyMessage = message.toLowerCase().includes('worker profile not found')
      ? t('worker.gate.missingProfile')
      : message.toLowerCase().includes('token') || message.toLowerCase().includes('unauthorized')
      ? t('worker.gate.sessionExpired')
      : message;

    return (
      <Screen>
        <ErrorState message={friendlyMessage} onRetry={workerQuery.refetch} />
        <Button
          title={t('common.signOut')}
          variant="outline"
          onPress={() => {
            void logout();
          }}
        />
      </Screen>
    );
  }

  const isComplete = isWorkerProfileComplete(workerQuery.data);
  if (!isComplete && !completedThisSession) {
    return (
      <WorkerOnboardingScreen
        initialWorker={workerQuery.data}
        onComplete={() => {
          setCompletedThisSession(true);
          queryClient.invalidateQueries({ queryKey: queryKeys.workerMe(user?.id) });
        }}
      />
    );
  }

  return <WorkerStack />;
}

function normalizeUnreadCount(value: unknown) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'unreadCount' in value) {
    const count = Number((value as { unreadCount?: unknown }).unreadCount);
    return Number.isFinite(count) ? count : 0;
  }
  return 0;
}

function AuthenticatedApp({ role }: { role?: string }) {
  const { t } = useLanguage();
  const user = useAuthStore(s => s.user);
  useSocket();

  const setUnreadCount = useChatStore(s => s.setUnreadCount);
  const unreadQuery = useQuery({
    queryKey: queryKeys.messagesUnreadCount(user?.id),
    queryFn: requestService.unreadCount,
    enabled: Boolean(user?.id),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (unreadQuery.data !== undefined) {
      setUnreadCount(normalizeUnreadCount(unreadQuery.data));
    }
  }, [setUnreadCount, unreadQuery.data]);

  return (
    <Stack.Navigator>
      {role === 'WORKER' ? (
        <Stack.Screen name="WorkerApp" component={WorkerGate} options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="CustomerApp" component={CustomerStack} options={{ headerShown: false }} />
      )}
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: t('nav.messages') }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: t('nav.chat') }} />
      <Stack.Screen name="Map" component={InAppMapScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useAuth();
  const hydrated = useAuthStore(s => s.hydrated);
  useRevenueCatIdentity(user?.id ?? null);
  const navigationKey = user ? `${user.id}:${user.role}` : 'auth';

  if (!hydrated) {
    return (
      <Screen>
        <ListSkeleton count={4} />
      </Screen>
    );
  }

  return (
    <NavigationContainer key={navigationKey}>
      {!user ? <AuthStack /> : <AuthenticatedApp key={navigationKey} role={user.role} />}
    </NavigationContainer>
  );
}

export { Stack };

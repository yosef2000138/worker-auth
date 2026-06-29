import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MessagesHeaderButton } from '@/components/messages/MessagesHeaderButton';
import { RootStackParamList } from '@/types';
import DashboardScreen from '@/screens/worker/DashboardScreen';
import IncomingRequestsScreen from '@/screens/worker/IncomingRequestsScreen';
import ActiveJobScreen from '@/screens/worker/ActiveJobScreen';
import ReviewsScreen from '@/screens/worker/ReviewsScreen';
import AvailabilityScreen from '@/screens/worker/AvailabilityScreen';
import WorkerProfileScreen from '@/screens/worker/WorkerProfileScreen';
import SubscriptionScreen from '@/screens/worker/SubscriptionScreen';
import ChatScreen from '@/screens/customer/ChatScreen';
import { useLanguage } from '@/i18n';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<RootStackParamList>();
const messagesHeader = () => <MessagesHeaderButton />;

function DashboardStack() {
  const { t } = useLanguage();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="WorkerDashboard"
        component={DashboardScreen}
        options={{ title: t('nav.dashboard'), headerRight: messagesHeader }}
      />
      <Stack.Screen
        name="IncomingRequests"
        component={IncomingRequestsScreen}
        options={{ title: t('nav.incomingRequests'), headerRight: messagesHeader }}
      />
      <Stack.Screen name="ActiveJob" component={ActiveJobScreen} options={{ title: t('nav.jobDetails') }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: t('nav.chat') }} />
    </Stack.Navigator>
  );
}

export default function WorkerStack() {
  const { t } = useLanguage();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === 'WorkerJobs' ? 'briefcase-outline'
            : route.name === 'Reviews' ? 'star-outline'
            : route.name === 'Availability' ? 'calendar-outline'
            : route.name === 'Subscription' ? 'card-outline'
            : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="WorkerJobs" component={DashboardStack} options={{ title: t('nav.jobs'), headerShown: false }} />
      <Tabs.Screen name="Reviews" component={ReviewsScreen} options={{ title: t('nav.reviews'), headerRight: messagesHeader }} />
      <Tabs.Screen name="Availability" component={AvailabilityScreen} options={{ title: t('nav.workCalendar'), headerRight: messagesHeader }} />
      <Tabs.Screen name="Subscription" component={SubscriptionScreen} options={{ title: t('nav.workerPro'), headerRight: messagesHeader }} />
      <Tabs.Screen name="WorkerOwnProfile" component={WorkerProfileScreen} options={{ title: t('nav.profile'), headerRight: messagesHeader }} />
    </Tabs.Navigator>
  );
}

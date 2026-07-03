import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessagesHeaderButton } from '@/components/messages/MessagesHeaderButton';
import CategoriesScreen from '@/screens/customer/CategoriesScreen';
import ChatScreen from '@/screens/customer/ChatScreen';
import CreateRequestScreen from '@/screens/customer/CreateRequestScreen';
import HomeScreen from '@/screens/customer/HomeScreen';
import MyRequestsScreen from '@/screens/customer/MyRequestsScreen';
import NotificationsScreen from '@/screens/customer/NotificationsScreen';
import ProfileScreen from '@/screens/customer/ProfileScreen';
import RatingScreen from '@/screens/customer/RatingScreen';
import RequestDetailsScreen from '@/screens/customer/RequestDetailsScreen';
import WorkerProfileScreen from '@/screens/customer/WorkerProfileScreen';
import OfferChatScreen from '@/screens/shared/OfferChatScreen';
import { RootStackParamList } from '@/types';
import { useLanguage } from '@/i18n';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<RootStackParamList>();

const messagesHeader = () => <MessagesHeaderButton />;

function HomeStack() {
  const { t } = useLanguage();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CustomerHome"
        component={HomeScreen}
        options={{ title: t('nav.home'), headerRight: messagesHeader }}
      />
      <Stack.Screen name="MyRequests" component={MyRequestsScreen} options={{ title: t('requests.mine.title'), headerRight: messagesHeader }} />
      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: t('nav.categories'), headerRight: messagesHeader }} />
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} options={{ title: t('nav.createRequest') }} />
      <Stack.Screen name="WorkerProfile" component={WorkerProfileScreen} options={{ title: t('nav.workerProfile') }} />
      <Stack.Screen name="RequestDetails" component={RequestDetailsScreen} options={{ title: t('nav.requestDetails') }} />
      <Stack.Screen name="Rating" component={RatingScreen} options={{ title: t('nav.rating') }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: t('nav.chat') }} />
      <Stack.Screen name="OfferChat" component={OfferChatScreen} options={{ title: t('offers.privateChat') }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('nav.notifications') }} />
    </Stack.Navigator>
  );
}

export default function CustomerStack() {
  const { t } = useLanguage();

  return (
    <Tabs.Navigator>
      <Tabs.Screen name="CustomerHomeTab" component={HomeStack} options={{ title: t('nav.home'), headerShown: false }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: t('nav.profile'), headerRight: messagesHeader }} />
    </Tabs.Navigator>
  );
}

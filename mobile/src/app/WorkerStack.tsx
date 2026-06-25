import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import DashboardScreen from '@/screens/worker/DashboardScreen';
import IncomingRequestsScreen from '@/screens/worker/IncomingRequestsScreen';
import ActiveJobScreen from '@/screens/worker/ActiveJobScreen';
import EarningsScreen from '@/screens/worker/EarningsScreen';
import ReviewsScreen from '@/screens/worker/ReviewsScreen';
import AvailabilityScreen from '@/screens/worker/AvailabilityScreen';
import WorkerProfileScreen from '@/screens/worker/WorkerProfileScreen';
import ChatScreen from '@/screens/customer/ChatScreen';
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<RootStackParamList>();
function DashboardStack() { return <Stack.Navigator><Stack.Screen name="WorkerDashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} /><Stack.Screen name="IncomingRequests" component={IncomingRequestsScreen} /><Stack.Screen name="ActiveJob" component={ActiveJobScreen} /><Stack.Screen name="Chat" component={ChatScreen} /></Stack.Navigator>; }
export default function WorkerStack() { return <Tabs.Navigator><Tabs.Screen name="WorkerDashboard" component={DashboardStack} options={{ title: 'Jobs', headerShown: false }} /><Tabs.Screen name="Earnings" component={EarningsScreen} /><Tabs.Screen name="Reviews" component={ReviewsScreen} /><Tabs.Screen name="Availability" component={AvailabilityScreen} /><Tabs.Screen name="WorkerOwnProfile" component={WorkerProfileScreen} options={{ title: 'Profile' }} /></Tabs.Navigator>; }

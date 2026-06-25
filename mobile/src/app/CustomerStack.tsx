import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import HomeScreen from '@/screens/customer/HomeScreen';
import CategoriesScreen from '@/screens/customer/CategoriesScreen';
import CreateRequestScreen from '@/screens/customer/CreateRequestScreen';
import WorkerSearchScreen from '@/screens/customer/WorkerSearchScreen';
import WorkerProfileScreen from '@/screens/customer/WorkerProfileScreen';
import RequestDetailsScreen from '@/screens/customer/RequestDetailsScreen';
import ChatScreen from '@/screens/customer/ChatScreen';
import NotificationsScreen from '@/screens/customer/NotificationsScreen';
import FavoritesScreen from '@/screens/customer/FavoritesScreen';
import ProfileScreen from '@/screens/customer/ProfileScreen';
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<RootStackParamList>();
function HomeStack() { return <Stack.Navigator><Stack.Screen name="CustomerHome" component={HomeScreen} options={{ title: 'Home' }} /><Stack.Screen name="Categories" component={CategoriesScreen} /><Stack.Screen name="CreateRequest" component={CreateRequestScreen} /><Stack.Screen name="WorkerSearch" component={WorkerSearchScreen} /><Stack.Screen name="WorkerProfile" component={WorkerProfileScreen} /><Stack.Screen name="RequestDetails" component={RequestDetailsScreen} /><Stack.Screen name="Chat" component={ChatScreen} /><Stack.Screen name="Notifications" component={NotificationsScreen} /></Stack.Navigator>; }
export default function CustomerStack() { return <Tabs.Navigator><Tabs.Screen name="CustomerHome" component={HomeStack} options={{ title: 'Home', headerShown: false }} /><Tabs.Screen name="Favorites" component={FavoritesScreen} /><Tabs.Screen name="Profile" component={ProfileScreen} /></Tabs.Navigator>; }

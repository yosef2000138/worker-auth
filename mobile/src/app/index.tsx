import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import AuthStack from './AuthStack';
import CustomerStack from './CustomerStack';
import WorkerStack from './WorkerStack';
import { useAuth } from '@/hooks/useAuth';
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function AppNavigator() { const { user } = useAuth(); return <NavigationContainer>{!user ? <AuthStack /> : user.role === 'WORKER' ? <WorkerStack /> : <CustomerStack />}</NavigationContainer>; }
export { Stack };

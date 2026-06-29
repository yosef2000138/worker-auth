import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import OnboardingScreen from '@/screens/auth/OnboardingScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import SplashScreen from '@/screens/auth/SplashScreen';
import { RootStackParamList } from '@/types';
import { useLanguage } from '@/i18n';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AuthStack() {
  const { isRTL } = useLanguage();

  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: isRTL ? 'slide_from_left' : 'slide_from_right',
        contentStyle: { backgroundColor: '#F4F7FB' },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

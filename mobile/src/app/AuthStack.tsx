import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import SplashScreen from '@/screens/auth/SplashScreen';
import OnboardingScreen from '@/screens/auth/OnboardingScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function AuthStack() { return <Stack.Navigator initialRouteName="Splash"><Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} /><Stack.Screen name="Onboarding" component={OnboardingScreen} /><Stack.Screen name="Login" component={LoginScreen} /><Stack.Screen name="Register" component={RegisterScreen} /><Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} /></Stack.Navigator>; }

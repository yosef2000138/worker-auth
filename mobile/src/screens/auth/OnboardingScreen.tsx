import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Button, Screen, Title, Body } from '@/components/ui';
type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;
export default function OnboardingScreen({ navigation }: Props) { return <Screen><Title>Find help fast</Title><Body>Create requests, chat with workers, and manage payments from one app.</Body><Button title="Login" onPress={() => navigation.navigate('Login')} /><Button title="Create account" onPress={() => navigation.navigate('Register')} /></Screen>; }

import React, { useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Screen, Title, Body } from '@/components/ui';
type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;
export default function SplashScreen({ navigation }: Props) { useEffect(() => { const t = setTimeout(() => navigation.replace('Onboarding'), 700); return () => clearTimeout(t); }, [navigation]); return <Screen><Title>Worker</Title><Body>Connecting customers with trusted workers.</Body></Screen>; }

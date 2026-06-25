import React, { useState } from 'react';
import { Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '@/types';
import { Button, Field, Screen, Title } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login } = useAuth();

  const handleLogin = () => {
    login.mutate(
      {
        email: email.trim().toLowerCase(),
        password,
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Login success');
        },
        onError: (error) => {
          Alert.alert('Login failed', error.message);
        },
      }
    );
  };

  return (
    <Screen>
      <Title>Login</Title>

      <Field
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Field
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button
        title="Login"
        loading={login.isPending}
        onPress={handleLogin}
      />

      <Button
        title="Forgot password"
        onPress={() => navigation.navigate('ForgotPassword')}
      />

      <Button
        title="Create account"
        variant="outline"
        onPress={() => navigation.navigate('Register')}
      />
    </Screen>
  );
}

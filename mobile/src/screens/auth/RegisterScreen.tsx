import React, { useState } from 'react';
import { Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Field, Screen, Title, Banner, BodySm } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { RootStackParamList } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [worker, setWorker] = useState(false);
  const { register } = useAuth();

  const handleRegister = () => {
    if (fullName.trim().length < 2) {
      Alert.alert('Check name', 'Full name must have at least 2 letters.');
      return;
    }
    if (!email.trim().includes('@')) {
      Alert.alert('Check email', 'Enter a valid email address.');
      return;
    }
    if (phone.trim() && !/^(\+?[1-9]\d{7,14}|0\d{8,14})$/.test(phone.trim())) {
      Alert.alert('Check phone', 'Use a phone like 0501234567 or +972501234567.');
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      Alert.alert('Check password', 'Password must be at least 8 characters and include 1 uppercase letter and 1 number.');
      return;
    }

    register.mutate(
      {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        role: worker ? 'WORKER' : 'CUSTOMER',
      },
      {
        onSuccess: () => {
          Alert.alert('Account created', 'Please login with your email and password.');
          navigation.replace('Login');
        },
        onError: (error) => {
          Alert.alert('Register failed', error.message);
        },
      },
    );
  };

  return (
    <Screen>
      <Title>Create account</Title>
      {register.isError ? <Banner tone="danger" message={register.error.message} /> : null}
      <Field label="Full name" placeholder="Full name" value={fullName} onChangeText={setFullName} />
      <Field label="Email" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Phone" placeholder="0501234567" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Password" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry helperText="Use at least 8 chars, 1 uppercase letter, and 1 number." />
      <Button title={worker ? 'Role: Worker' : 'Role: Customer'} variant="outline" onPress={() => setWorker(!worker)} />
      <Button title="Register" loading={register.isPending} onPress={handleRegister} />
      <BodySm center>After register, you will return to login.</BodySm>
    </Screen>
  );
}

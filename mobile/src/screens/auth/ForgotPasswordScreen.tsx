import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { Button, Field, Screen, Title, Body } from '@/components/ui';
export default function ForgotPasswordScreen() { const [email, setEmail] = useState(''); const mutation = useMutation({ mutationFn: () => authService.forgotPassword(email) }); return <Screen><Title>Forgot password</Title><Field placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" /><Button title="Send reset link" loading={mutation.isPending} onPress={() => mutation.mutate()} />{mutation.isSuccess ? <Body>Check your email.</Body> : null}</Screen>; }

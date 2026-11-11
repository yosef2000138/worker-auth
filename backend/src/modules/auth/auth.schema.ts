import { z } from 'zod';

const phoneSchema = z
  .string()
  .regex(/^(\+?[1-9]\d{7,14}|0\d{8,14})$/, 'Invalid phone number');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a number');

const oneTimeTokenSchema = z.string().regex(/^[a-f0-9]{64}$/i);

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    role: z.enum(['CUSTOMER', 'WORKER']).default('CUSTOMER'),
  }).strict(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
  }).strict(),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
  }).strict(),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: oneTimeTokenSchema,
    newPassword: passwordSchema,
  }).strict(),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1).max(4096),
  }).strict(),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: oneTimeTokenSchema,
  }).strict(),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];

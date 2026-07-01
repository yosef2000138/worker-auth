import { z } from 'zod';

const phoneSchema = z
  .string()
  .regex(/^(\+?[1-9]\d{7,14}|0\d{8,14})$/, 'Invalid phone number');

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(100).trim().optional(),
    phone: phoneSchema.optional().nullable(),
    avatarUrl: z.string().url().optional().nullable(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];

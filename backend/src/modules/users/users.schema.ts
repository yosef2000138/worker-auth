import { z } from 'zod';

const phoneSchema = z
  .string()
  .regex(/^(\+?[1-9]\d{7,14}|0\d{8,14})$/, 'Invalid phone number');

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(100).optional(),
    phone: phoneSchema.optional().nullable(),
    avatarUrl: z.string().url().max(2048).optional().nullable(),
  }).strict(),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
  }).strict(),
});

export const requestHistorySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }).strict(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];

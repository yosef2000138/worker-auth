import { z } from 'zod';

export const listUsersSchema = z.object({
  query: z.object({
    role: z.enum(['CUSTOMER', 'WORKER', 'ADMIN']).optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
  }).strict(),
});

export const userIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
});

export const listWorkersAdminSchema = z.object({
  query: z.object({
    approved: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).strict(),
});

export const workerIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
});

export const listRequestsAdminSchema = z.object({
  query: z.object({
    status: z
      .enum(['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).strict(),
});

export const analyticsSchema = z.object({
  query: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).strict().refine(
    value => !value.from || !value.to || new Date(value.from) <= new Date(value.to),
    { message: 'The from date must not be after the to date', path: ['from'] },
  ),
});

export const categorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    icon: z.string().max(10).optional(),
    description: z.string().max(500).optional(),
  }).strict(),
});

export const categoryIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    icon: z.string().max(10).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  }).strict(),
});

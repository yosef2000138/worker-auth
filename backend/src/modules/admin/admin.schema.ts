import { z } from 'zod';

export const listUsersSchema = z.object({
  query: z.object({
    role: z.enum(['CUSTOMER', 'WORKER', 'ADMIN']).optional(),
    isActive: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listWorkersAdminSchema = z.object({
  query: z.object({
    approved: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const workerIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listRequestsAdminSchema = z.object({
  query: z.object({
    status: z
      .enum(['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const analyticsSchema = z.object({
  query: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
});

export const categorySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).trim(),
    icon: z.string().max(10).optional(),
    description: z.string().max(500).optional(),
  }),
});

export const categoryIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    icon: z.string().max(10).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  }),
});

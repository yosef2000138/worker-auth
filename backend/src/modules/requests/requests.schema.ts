import { z } from 'zod';

// IDs are UUIDs (schema uses @default(uuid()))
const uuidSchema = z.string().uuid('Invalid ID format');

export const createRequestSchema = z.object({
  body: z.object({
    categoryId:    uuidSchema,
    title:         z.string().min(5, 'Title too short').max(200).trim(),
    description:   z.string().min(10, 'Description too short').max(2000).trim(),
    lat:           z.coerce.number().min(-90).max(90),
    lng:           z.coerce.number().min(-180).max(180),
    address:       z.string().min(5).max(500).trim(),
    scheduledAt:   z.string().datetime().optional(),
    paymentMethod: z.enum(['ONLINE', 'CASH']).default('CASH'),
  }),
});

export const updateStatusSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    status: z.enum([
      'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
    ]),
    cancellationReason: z.string().max(500).optional(),
  }),
});

export const listRequestsSchema = z.object({
  query: z.object({
    status: z
      .enum(['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
      .optional(),
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const cancelSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});

export const createRequestReviewSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).trim().optional(),
  }),
});

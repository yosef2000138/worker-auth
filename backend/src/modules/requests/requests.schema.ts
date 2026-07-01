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

export const requestIdParamSchema = z.object({
  params: z.object({ requestId: uuidSchema }),
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

export const createOfferSchema = z.object({
  params: z.object({ requestId: uuidSchema }),
  body: z.object({
    proposedPrice: z.coerce.number().positive().optional(),
    message: z.string().min(1).max(1000).trim().optional(),
    availableAt: z.string().datetime().optional(),
    estimatedDuration: z.string().max(120).trim().optional(),
  }),
});

export const offerParamSchema = z.object({
  params: z.object({ requestId: uuidSchema, offerId: uuidSchema }),
});

export const listOfferMessagesSchema = z.object({
  params: z.object({ requestId: uuidSchema, offerId: uuidSchema }),
  query: z.object({
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const sendOfferMessageSchema = z.object({
  params: z.object({ requestId: uuidSchema, offerId: uuidSchema }),
  body: z.object({
    content: z.string().min(1).max(2000).trim(),
  }),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>['body'];
export type SendOfferMessageInput = z.infer<typeof sendOfferMessageSchema>['body'];

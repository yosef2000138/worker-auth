import { z } from 'zod';

export const createReviewSchema = z.object({
  body: z.object({
    requestId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).trim().optional(),
  }),
});

export const listWorkerReviewsSchema = z.object({
  params: z.object({ workerId: z.string().uuid() }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const reviewIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>['body'];

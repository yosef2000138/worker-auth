import { z } from 'zod';

export const createReviewSchema = z.object({
  body: z.object({
    requestId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional(),
  }).strict(),
});

export const listWorkerReviewsSchema = z.object({
  params: z.object({ workerId: z.string().uuid() }).strict(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }).strict(),
});

export const reviewIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>['body'];

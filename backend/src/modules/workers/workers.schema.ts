import { z } from 'zod';

export const updateWorkerProfileSchema = z.object({
  body: z.object({
    bio: z.string().max(1000).trim().optional().nullable(),
    yearsExp: z.number().int().min(0).max(60).optional(),
    hourlyRate: z.number().positive().optional().nullable(),
    fixedPrice: z.number().positive().optional().nullable(),
    workingRadius: z.number().int().min(1).max(200).optional(),
  }),
});

export const setCategoriesSchema = z.object({
  body: z.object({
    categoryIds: z.array(z.string().uuid()).min(1).max(10),
  }),
});

export const setAvailabilitySchema = z.object({
  body: z.object({
    slots: z.array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
      }),
    ),
  }),
});

export const toggleAvailabilitySchema = z.object({
  body: z.object({
    isAvailable: z.boolean(),
  }),
});

export const searchWorkersSchema = z.object({
  query: z.object({
    categoryId: z.string().uuid().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRate: z.coerce.number().positive().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sort: z.enum(['rating', 'jobs', 'rate']).optional(),
  }),
});

export const workerIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const workerReviewsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export type UpdateWorkerProfileInput = z.infer<typeof updateWorkerProfileSchema>['body'];
export type SetCategoriesInput = z.infer<typeof setCategoriesSchema>['body'];
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>['body'];

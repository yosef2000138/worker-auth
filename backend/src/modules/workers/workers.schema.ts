import { z } from 'zod';

const emptyToUndefined = (value: unknown) => value === '' ? undefined : value;
const serviceCitySchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(100).optional().nullable(),
);
const coordinateSchema = (min: number, max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().min(min).max(max).optional().nullable());

export const updateWorkerProfileSchema = z.object({
  body: z.object({
    bio: z.string().trim().max(1000).optional().nullable(),
    yearsExp: z.number().int().min(0).max(60).optional(),
    hourlyRate: z.number().positive().optional().nullable(),
    fixedPrice: z.number().positive().optional().nullable(),
    workingRadius: z.number().int().min(1).max(200).optional(),
    primaryServiceCity: serviceCitySchema,
    additionalServiceCities: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    serviceRadiusKm: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional().nullable()),
    baseLatitude: coordinateSchema(-90, 90),
    baseLongitude: coordinateSchema(-180, 180),
  }).strict()
    .refine(
      data => (data.baseLatitude == null && data.baseLongitude == null) || (data.baseLatitude != null && data.baseLongitude != null),
      {
        message: 'Base latitude and longitude must be provided together',
        path: ['baseLatitude'],
      },
    ),
});

export const setCategoriesSchema = z.object({
  body: z.object({
    categoryIds: z.array(z.string().uuid()).min(1).max(10)
      .refine(ids => new Set(ids).size === ids.length, 'Category IDs must be unique'),
  }).strict(),
});

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM');

export const setAvailabilitySchema = z.object({
  body: z.object({
    slots: z.array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: timeSchema,
        endTime: timeSchema,
      }).strict().refine(slot => slot.startTime < slot.endTime, {
        message: 'End time must be later than start time',
        path: ['endTime'],
      }),
    ).max(21),
  }).strict(),
});

export const toggleAvailabilitySchema = z.object({
  body: z.object({
    isAvailable: z.boolean(),
  }).strict(),
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
  }).strict(),
});

export const workerIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
});

export const workerReviewsSchema = z.object({
  params: z.object({ id: z.string().uuid() }).strict(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }).strict(),
});

export type UpdateWorkerProfileInput = z.infer<typeof updateWorkerProfileSchema>['body'];
export type SetCategoriesInput = z.infer<typeof setCategoriesSchema>['body'];
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>['body'];

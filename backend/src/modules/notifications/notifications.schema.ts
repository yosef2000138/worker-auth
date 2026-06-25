import { z } from 'zod';

export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    unreadOnly: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
  }),
});

export const notifIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

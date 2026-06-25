import { z } from 'zod';

export const requestIdParamSchema = z.object({
  params: z.object({ requestId: z.string().uuid() }),
});

export const sendMessageSchema = z.object({
  params: z.object({ requestId: z.string().uuid() }),
  body: z.object({
    content: z.string().min(1).max(2000).trim(),
  }),
});

export const listMessagesSchema = z.object({
  params: z.object({ requestId: z.string().uuid() }),
  query: z.object({
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>['body'];

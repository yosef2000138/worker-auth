import { z } from 'zod';

export const messageRequestIdSchema = z.string().uuid();
export const messageContentSchema = z.string().trim().min(1).max(2000);

export const requestIdParamSchema = z.object({
  params: z.object({ requestId: messageRequestIdSchema }).strict(),
});

export const sendMessageSchema = z.object({
  params: z.object({ requestId: messageRequestIdSchema }).strict(),
  body: z.object({
    content: messageContentSchema,
  }).strict(),
});

export const listMessagesSchema = z.object({
  params: z.object({ requestId: messageRequestIdSchema }).strict(),
  query: z.object({
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }).strict(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>['body'];

export const socketMessageSchema = z.object({
  requestId: messageRequestIdSchema,
  content: messageContentSchema,
}).strict();

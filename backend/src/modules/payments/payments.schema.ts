import { z } from 'zod';

export const createPaymentIntentSchema = z.object({
  body: z.object({
    requestId: z.string().uuid(),
  }),
});

export const confirmPaymentSchema = z.object({
  body: z.object({
    requestId: z.string().uuid(),
    amount: z.number().positive(),
  }),
});

export const paymentIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>['body'];
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>['body'];

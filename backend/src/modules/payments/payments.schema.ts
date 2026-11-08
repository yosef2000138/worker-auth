import { z } from 'zod';

const requestIdSchema = z.string().uuid();
const paymentAmountSchema = z.number()
  .positive()
  .max(1_000_000)
  .multipleOf(0.01);

export const createPaymentIntentSchema = z.object({
  body: z.object({
    requestId: requestIdSchema,
  }).strict(),
});

export const confirmPaymentSchema = z.object({
  body: z.object({
    requestId: requestIdSchema,
    amount: paymentAmountSchema,
  }).strict(),
});

export const recordCashPaymentSchema = z.object({
  body: z.object({
    requestId: requestIdSchema,
    amount: paymentAmountSchema,
  }).strict(),
});

export const paymentRequestParamSchema = z.object({
  params: z.object({ requestId: requestIdSchema }).strict(),
});

export const paymentHistorySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }).strict(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>['body'];
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>['body'];

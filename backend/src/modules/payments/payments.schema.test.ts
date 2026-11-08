import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentHistorySchema,
  paymentRequestParamSchema,
  recordCashPaymentSchema,
} from './payments.schema';

const requestId = '11111111-1111-4111-8111-111111111111';

test('cash payment requires a UUID and bounded two-decimal amount', () => {
  assert.equal(recordCashPaymentSchema.parse({
    body: { requestId, amount: 125.5 },
  }).body.amount, 125.5);

  assert.throws(() => recordCashPaymentSchema.parse({ body: { requestId: 'bad', amount: 1 } }));
  assert.throws(() => recordCashPaymentSchema.parse({ body: { requestId, amount: -1 } }));
  assert.throws(() => recordCashPaymentSchema.parse({ body: { requestId, amount: 1.001 } }));
  assert.throws(() => recordCashPaymentSchema.parse({ body: { requestId, amount: 1, status: 'COMPLETED' } }));
});

test('payment lookup and history inputs are validated and paginated safely', () => {
  assert.equal(paymentRequestParamSchema.parse({ params: { requestId } }).params.requestId, requestId);
  assert.equal(paymentHistorySchema.parse({ query: {} }).query.limit, 10);
  assert.throws(() => paymentHistorySchema.parse({ query: { page: 0 } }));
  assert.throws(() => paymentHistorySchema.parse({ query: { limit: 101 } }));
});

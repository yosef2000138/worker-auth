import test from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response } from 'express';
import { confirm } from './payments.controller';
import {
  confirmPayment,
  createPaymentIntent,
  paymentProviderNotConfiguredError,
} from './payments.service';

const requestId = '11111111-1111-4111-8111-111111111111';

function expectPaymentDisabled(fn: () => Promise<unknown>) {
  return assert.rejects(fn, (error: unknown) => {
    const typed = error as { status?: number; code?: string; message?: string };
    assert.equal(typed.status, 501);
    assert.equal(typed.code, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
    assert.equal(typed.message, 'Online payments are not available in this build.');
    return true;
  });
}

test('payment provider disabled error is safe and coded', () => {
  assert.deepEqual(paymentProviderNotConfiguredError(), {
    status: 501,
    code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
    message: 'Online payments are not available in this build.',
  });
});

test('customer cannot use client payment confirmation to mark a request paid', async () => {
  await expectPaymentDisabled(() => confirmPayment({ requestId, amount: 1 }));
});

test('worker cannot use client payment confirmation to mark a request paid', async () => {
  await expectPaymentDisabled(() => confirmPayment({ requestId, amount: 1 }));
});

test('client-provided amount and status are ignored because confirmation is disabled before DB access', async () => {
  const maliciousInput = {
    requestId,
    amount: 1,
    status: 'COMPLETED',
  };

  await expectPaymentDisabled(() => confirmPayment(maliciousInput));
});

test('client-provided requestId cannot create a completed online payment', async () => {
  await expectPaymentDisabled(() => createPaymentIntent('customer-user-1', { requestId }));
});

test('payment confirm controller returns a safe error through the shared error handler path', async () => {
  const req = {
    body: {
      requestId,
      amount: 1,
      status: 'COMPLETED',
    },
  } as Request;
  const res = {
    json: () => {
      throw new Error('confirm response should not be sent');
    },
  } as unknown as Response;
  let nextError: unknown;

  await confirm(req, res, (error?: unknown) => {
    nextError = error;
  });

  assert.deepEqual(nextError, paymentProviderNotConfiguredError());
});

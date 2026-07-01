import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOfferSchema,
  createRequestReviewSchema,
  createRequestSchema,
  listOfferMessagesSchema,
} from './requests.schema';

const params = { id: '11111111-1111-4111-8111-111111111111' };
const offerParams = {
  requestId: '11111111-1111-4111-8111-111111111111',
  offerId: '22222222-2222-4222-8222-222222222222',
};

const validRequestBody = {
  categoryId: '33333333-3333-4333-8333-333333333333',
  title: 'Electrical outlet repair',
  description: 'Two kitchen outlets stopped working and need inspection.',
  lat: 32.0853,
  lng: 34.7818,
  address: 'Dizengoff Street, Tel Aviv',
  paymentMethod: 'CASH',
};

test('create request schema accepts request-first payload without worker assignment', () => {
  const parsed = createRequestSchema.parse({ body: validRequestBody });

  assert.equal(parsed.body.title, 'Electrical outlet repair');
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.body, 'workerId'), false);
});

test('create request schema rejects direct worker assignment fields', () => {
  for (const field of ['workerId', 'selectedWorkerId', 'assignedWorkerId']) {
    const parsed = createRequestSchema.safeParse({
      body: { ...validRequestBody, [field]: '44444444-4444-4444-8444-444444444444' },
    });

    assert.equal(parsed.success, false, `${field} should be rejected`);
  }
});

test('request review schema accepts a 1 through 5 star rating', () => {
  for (const rating of [1, 2, 3, 4, 5]) {
    const parsed = createRequestReviewSchema.parse({
      params,
      body: { rating, comment: ' Professional and on time. ' },
    });

    assert.equal(parsed.body.rating, rating);
    assert.equal(parsed.body.comment, 'Professional and on time.');
  }
});

test('request review schema rejects rating below one', () => {
  assert.equal(createRequestReviewSchema.safeParse({
    params,
    body: { rating: 0 },
  }).success, false);
});

test('request review schema rejects rating above five', () => {
  assert.equal(createRequestReviewSchema.safeParse({
    params,
    body: { rating: 6 },
  }).success, false);
});

test('request review schema allows an empty optional comment', () => {
  const parsed = createRequestReviewSchema.parse({
    params,
    body: { rating: 5 },
  });

  assert.equal(parsed.body.comment, undefined);
});

test('create offer schema trims message and coerces proposed price', () => {
  const parsed = createOfferSchema.parse({
    params: { requestId: offerParams.requestId },
    body: {
      proposedPrice: '175.50',
      message: ' I can arrive today. ',
      estimatedDuration: '2 hours',
    },
  });

  assert.equal(parsed.body.proposedPrice, 175.5);
  assert.equal(parsed.body.message, 'I can arrive today.');
  assert.equal(parsed.body.estimatedDuration, '2 hours');
});

test('create offer schema rejects negative prices', () => {
  assert.equal(createOfferSchema.safeParse({
    params: { requestId: offerParams.requestId },
    body: { proposedPrice: -1 },
  }).success, false);
});

test('offer messages schema caps page size at 100', () => {
  assert.equal(listOfferMessagesSchema.safeParse({
    params: offerParams,
    query: { limit: 101 },
  }).success, false);
});

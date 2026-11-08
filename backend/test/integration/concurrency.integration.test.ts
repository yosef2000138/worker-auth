import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { startApplication, stopApplication } from '../../src/app';
import { db } from '../../src/config/database';
import {
  confirmOffer,
  createOffer,
  withdrawOffer,
} from '../../src/modules/requests/offers.service';
import { cancelRequest, updateStatus } from '../../src/modules/requests/requests.service';
import {
  createCategory,
  createRequestFixture,
  createUser,
  createWorker,
  offerInput,
  resetIntegrationState,
} from './helpers';

let server: Awaited<ReturnType<typeof startApplication>>['httpServer'];

before(async () => {
  server = (await startApplication(0)).httpServer;
  await resetIntegrationState();
});

after(async () => {
  await resetIntegrationState();
  await stopApplication(server);
});

async function offerScenario(workerCount: number) {
  const category = await createCategory();
  const customer = await createUser('CUSTOMER', 'concurrency-customer');
  const workers = await Promise.all(
    Array.from({ length: workerCount }, (_, index) => createWorker(category.id, `concurrency-worker-${index}`)),
  );
  const request = await createRequestFixture(customer.id, category.id);
  return { category, customer, workers, request };
}

test('ten concurrent offer submissions never create more than five active offers', async () => {
  await resetIntegrationState();
  const { workers, request } = await offerScenario(10);
  const results = await Promise.allSettled(
    workers.map(({ user }, index) => createOffer(request.id, user.id, offerInput(index + 1))),
  );

  assert.equal(results.filter(result => result.status === 'fulfilled').length, 5);
  assert.equal(results.filter(result => result.status === 'rejected').length, 5);
  assert.equal(await db.requestOffer.count({
    where: { requestId: request.id, status: { in: ['SUBMITTED', 'DISCUSSING'] } },
  }), 5);
});

test('two simultaneous confirmations assign exactly one worker and consume quota once', async () => {
  await resetIntegrationState();
  const { customer, workers, request } = await offerScenario(2);
  const offers = await Promise.all(
    workers.map(({ user }, index) => createOffer(request.id, user.id, offerInput(index + 1))),
  );
  const confirmations = await Promise.allSettled(
    offers.map(({ offer }) => confirmOffer(request.id, offer.id, customer.id)),
  );

  assert.equal(confirmations.filter(result => result.status === 'fulfilled').length, 1);
  const stored = await db.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.equal(stored.status, 'ACCEPTED');
  assert.ok(stored.workerId);
  assert.equal(await db.requestOffer.count({ where: { requestId: request.id, status: 'SELECTED' } }), 1);
  assert.equal(await db.workerAcceptanceUsage.count({ where: { requestId: request.id } }), 1);
});

test('withdrawal and confirmation serialize into a consistent final state', async () => {
  await resetIntegrationState();
  const { customer, workers, request } = await offerScenario(1);
  const created = await createOffer(request.id, workers[0].user.id, offerInput());
  const results = await Promise.allSettled([
    withdrawOffer(request.id, created.offer.id, workers[0].user.id),
    confirmOffer(request.id, created.offer.id, customer.id),
  ]);

  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const [storedRequest, storedOffer] = await Promise.all([
    db.serviceRequest.findUniqueOrThrow({ where: { id: request.id } }),
    db.requestOffer.findUniqueOrThrow({ where: { id: created.offer.id } }),
  ]);
  const selected = storedRequest.status === 'ACCEPTED' && storedOffer.status === 'SELECTED' && storedRequest.workerId === workers[0].worker.id;
  const withdrawn = storedRequest.status === 'PENDING' && storedOffer.status === 'WITHDRAWN' && storedRequest.workerId === null;
  assert.equal(selected || withdrawn, true);
});

test('cancellation and confirmation cannot leave an accepted request with open offers', async () => {
  await resetIntegrationState();
  const { customer, workers, request } = await offerScenario(1);
  const created = await createOffer(request.id, workers[0].user.id, offerInput());
  await Promise.allSettled([
    cancelRequest(request.id, customer.id, 'CUSTOMER', 'Concurrency cancellation'),
    confirmOffer(request.id, created.offer.id, customer.id),
  ]);

  const storedRequest = await db.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
  const activeOffers = await db.requestOffer.count({
    where: { requestId: request.id, status: { in: ['SUBMITTED', 'DISCUSSING'] } },
  });
  assert.equal(storedRequest.status, 'CANCELLED');
  assert.equal(storedRequest.activeJobKey, null);
  assert.equal(activeOffers, 0);
  assert.ok((await db.requestOffer.findUniqueOrThrow({ where: { id: created.offer.id } })).status !== 'SUBMITTED');
});

test('concurrent status changes preserve the request state machine', async () => {
  await resetIntegrationState();
  const { customer, workers, request } = await offerScenario(1);
  const created = await createOffer(request.id, workers[0].user.id, offerInput());
  await confirmOffer(request.id, created.offer.id, customer.id);
  await Promise.allSettled([
    updateStatus(request.id, workers[0].user.id, 'WORKER', 'ON_THE_WAY'),
    updateStatus(request.id, workers[0].user.id, 'WORKER', 'IN_PROGRESS'),
  ]);

  const stored = await db.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.ok(stored.status === 'ON_THE_WAY' || stored.status === 'IN_PROGRESS');
});

test('repeated cancellation is idempotent at the data layer and does not duplicate quota usage', async () => {
  await resetIntegrationState();
  const { customer, request } = await offerScenario(1);
  const results = await Promise.allSettled([
    cancelRequest(request.id, customer.id, 'CUSTOMER', 'First cancellation'),
    cancelRequest(request.id, customer.id, 'CUSTOMER', 'Repeated cancellation'),
  ]);

  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const stored = await db.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.equal(stored.status, 'CANCELLED');
  assert.equal(stored.activeJobKey, null);
  assert.equal(await db.workerAcceptanceUsage.count({ where: { requestId: request.id } }), 0);
});

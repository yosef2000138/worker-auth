import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import jwt from 'jsonwebtoken';
import { io as createSocket, Socket } from 'socket.io-client';
import { startApplication, stopApplication } from '../../src/app';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { revokeSession } from '../../src/config/redis';
import { suspendUser } from '../../src/modules/admin/admin.service';
import { createOffer, sendOfferMessage } from '../../src/modules/requests/offers.service';
import {
  apiRequest,
  createAccessSession,
  createCategory,
  createRequestFixture,
  createUser,
  createWorker,
  offerInput,
  resetIntegrationState,
  TEST_PASSWORD,
} from './helpers';

let baseUrl = '';
let server: Awaited<ReturnType<typeof startApplication>>['httpServer'];

before(async () => {
  const started = await startApplication(0);
  server = started.httpServer;
  baseUrl = `http://127.0.0.1:${started.port}`;
  await resetIntegrationState();
});

after(async () => {
  await resetIntegrationState();
  await stopApplication(server);
});

test('registration, refresh rotation, password change, suspension, and logout revoke sessions', async () => {
  await resetIntegrationState();
  const email = `auth-${Date.now()}@worker.test`;
  const registration = await apiRequest(baseUrl, 'POST', '/api/v1/auth/register', {
    body: {
      fullName: 'Integration Customer',
      email,
      phone: '0501234567',
      password: TEST_PASSWORD,
      role: 'CUSTOMER',
    },
  });
  assert.equal(registration.status, 201);

  const login = await apiRequest(baseUrl, 'POST', '/api/v1/auth/login', {
    body: { email, password: TEST_PASSWORD },
  });
  assert.equal(login.status, 200);
  const { accessToken, refreshToken, user } = login.body.data;
  const profile = await apiRequest(baseUrl, 'GET', '/api/v1/users/profile', { token: accessToken });
  assert.equal(profile.status, 200);

  const rotations = await Promise.all([
    apiRequest(baseUrl, 'POST', '/api/v1/auth/refresh', { body: { refreshToken } }),
    apiRequest(baseUrl, 'POST', '/api/v1/auth/refresh', { body: { refreshToken } }),
  ]);
  assert.deepEqual(rotations.map(item => item.status).sort(), [200, 401]);
  const rotatedAccess = rotations.find(item => item.status === 200)!.body.data.accessToken;
  const revokedAfterReuse = await apiRequest(baseUrl, 'GET', '/api/v1/users/profile', { token: rotatedAccess });
  assert.equal(revokedAfterReuse.status, 401);

  const secondLogin = await apiRequest(baseUrl, 'POST', '/api/v1/auth/login', {
    body: { email, password: TEST_PASSWORD },
  });
  const secondAccess = secondLogin.body.data.accessToken;
  const passwordChange = await apiRequest(baseUrl, 'PUT', '/api/v1/users/change-password', {
    token: secondAccess,
    body: { currentPassword: TEST_PASSWORD, newPassword: 'NewPassword2' },
  });
  assert.equal(passwordChange.status, 200);
  assert.equal((await apiRequest(baseUrl, 'GET', '/api/v1/users/profile', { token: secondAccess })).status, 401);

  const thirdLogin = await apiRequest(baseUrl, 'POST', '/api/v1/auth/login', {
    body: { email, password: 'NewPassword2' },
  });
  assert.equal(thirdLogin.status, 200);
  await suspendUser(user.id);
  assert.equal((await apiRequest(baseUrl, 'GET', '/api/v1/users/profile', {
    token: thirdLogin.body.data.accessToken,
  })).status, 401);

  await db.user.update({ where: { id: user.id }, data: { isActive: true } });
  const finalLogin = await apiRequest(baseUrl, 'POST', '/api/v1/auth/login', {
    body: { email, password: 'NewPassword2' },
  });
  assert.equal((await apiRequest(baseUrl, 'POST', '/api/v1/auth/logout', {
    token: finalLogin.body.data.accessToken,
  })).status, 200);
  assert.equal((await apiRequest(baseUrl, 'GET', '/api/v1/users/profile', {
    token: finalLogin.body.data.accessToken,
  })).status, 401);
  assert.equal((await apiRequest(baseUrl, 'GET', '/api/v1/users/profile', { token: 'invalid' })).status, 401);

  const expiredAccessToken = jwt.sign(
    { sub: user.id, sid: 'expired-session', role: user.role, email: user.email },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      issuer: 'worker-api',
      audience: 'worker-mobile',
      expiresIn: -1,
    },
  );
  assert.equal((await apiRequest(baseUrl, 'GET', '/api/v1/users/profile', {
    token: expiredAccessToken,
  })).status, 401);
});

test('request, offer, chat, and review authorization preserve private data boundaries', async () => {
  await resetIntegrationState();
  const category = await createCategory('Privacy integration');
  const owner = await createUser('CUSTOMER', 'owner');
  const unrelatedCustomer = await createUser('CUSTOMER', 'unrelated-customer');
  const first = await createWorker(category.id, 'privacy-worker');
  const second = await createWorker(category.id, 'other-worker');
  const request = await createRequestFixture(owner.id, category.id);
  const ownerToken = (await createAccessSession(owner.id)).accessToken;
  const unrelatedToken = (await createAccessSession(unrelatedCustomer.id)).accessToken;
  const firstToken = (await createAccessSession(first.user.id)).accessToken;
  const secondToken = (await createAccessSession(second.user.id)).accessToken;

  const publicView = await apiRequest(baseUrl, 'GET', `/api/v1/requests/${request.id}`, { token: firstToken });
  assert.equal(publicView.status, 200);
  assert.equal(publicView.body.data.customer, undefined);
  assert.equal(publicView.body.data.lat, undefined);
  assert.equal(publicView.body.data.lng, undefined);
  assert.notEqual(publicView.body.data.address, request.address);

  const ownerView = await apiRequest(baseUrl, 'GET', `/api/v1/requests/${request.id}`, { token: ownerToken });
  assert.equal(ownerView.status, 200);
  assert.equal(ownerView.body.data.customer.phone, owner.phone);
  assert.equal(ownerView.body.data.address, request.address);
  assert.equal((await apiRequest(baseUrl, 'GET', `/api/v1/requests/${request.id}`, {
    token: unrelatedToken,
  })).status, 403);

  const firstOffer = await createOffer(request.id, first.user.id, offerInput(1));
  const secondOffer = await createOffer(request.id, second.user.id, offerInput(2));
  await sendOfferMessage(request.id, firstOffer.offer.id, first.user.id, { content: 'Private offer message' });
  assert.equal((await apiRequest(baseUrl, 'GET', `/api/v1/requests/${request.id}/offers/${firstOffer.offer.id}/messages`, {
    token: ownerToken,
  })).status, 200);
  assert.equal((await apiRequest(baseUrl, 'GET', `/api/v1/requests/${request.id}/offers/${firstOffer.offer.id}/messages`, {
    token: firstToken,
  })).status, 200);
  assert.equal((await apiRequest(baseUrl, 'GET', `/api/v1/requests/${request.id}/offers/${firstOffer.offer.id}/messages`, {
    token: secondToken,
  })).status, 403);

  const confirmation = await apiRequest(
    baseUrl,
    'POST',
    `/api/v1/requests/${request.id}/offers/${firstOffer.offer.id}/confirm`,
    { token: ownerToken },
  );
  assert.equal(confirmation.status, 200);
  const assignedView = await apiRequest(baseUrl, 'GET', `/api/v1/requests/${request.id}`, { token: firstToken });
  assert.equal(assignedView.body.data.customer.phone, owner.phone);
  assert.equal(assignedView.body.data.address, request.address);
  assert.equal(assignedView.body.data.lat, request.lat);
  const unselectedView = await apiRequest(baseUrl, 'GET', `/api/v1/requests/${request.id}`, { token: secondToken });
  assert.equal(unselectedView.status, 200);
  assert.equal(unselectedView.body.data.customer, undefined);
  assert.equal(unselectedView.body.data.address, 'haifa');
  assert.equal(unselectedView.body.data.lat, undefined);

  await db.serviceRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED' } });
  const review = await apiRequest(baseUrl, 'POST', `/api/v1/requests/${request.id}/reviews`, {
    token: ownerToken,
    body: { rating: 5, comment: 'Verified integration review' },
  });
  assert.equal(review.status, 201);
  assert.equal((await apiRequest(baseUrl, 'POST', `/api/v1/requests/${request.id}/reviews`, {
    token: unrelatedToken,
    body: { rating: 1 },
  })).status, 403);
  const storedSecondOffer = await db.requestOffer.findUniqueOrThrow({
    where: { id: secondOffer.offer.id },
  });
  assert.equal(storedSecondOffer.status, 'NOT_SELECTED');
});

test('HTTP request and offer lifecycle crosses validation, authorization, and persistence boundaries', async () => {
  await resetIntegrationState();
  const category = await createCategory('HTTP lifecycle integration');
  const customer = await createUser('CUSTOMER', 'http-customer');
  const worker = await createWorker(category.id, 'http-worker');
  const customerToken = (await createAccessSession(customer.id)).accessToken;
  const workerToken = (await createAccessSession(worker.user.id)).accessToken;

  const created = await apiRequest(baseUrl, 'POST', '/api/v1/requests', {
    token: customerToken,
    body: {
      categoryId: category.id,
      title: 'HTTP integration request',
      description: 'Validate the complete HTTP request and offer lifecycle.',
      serviceCity: 'haifa',
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      paymentMethod: 'CASH',
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, 'PENDING');
  assert.equal(created.body.data.worker, null);
  const requestId = created.body.data.id as string;

  const incoming = await apiRequest(
    baseUrl,
    'GET',
    '/api/v1/requests?status=PENDING&page=1&limit=30',
    { token: workerToken },
  );
  assert.equal(incoming.status, 200);
  assert.ok(incoming.body.data.items.some((item: { id: string }) => item.id === requestId));

  const submitted = await apiRequest(baseUrl, 'POST', `/api/v1/requests/${requestId}/offers`, {
    token: workerToken,
    body: offerInput(),
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.data.offer.status, 'SUBMITTED');
  const offerId = submitted.body.data.offer.id as string;

  const publicWorker = await apiRequest(baseUrl, 'GET', `/api/v1/workers/${worker.worker.id}`, {
    token: customerToken,
  });
  assert.equal(publicWorker.status, 200);
  assert.equal(publicWorker.body.data.user.email, undefined);
  assert.equal(publicWorker.body.data.user.phone, undefined);
  assert.equal(publicWorker.body.data.baseLatitude, undefined);
  assert.equal(publicWorker.body.data.baseLongitude, undefined);

  const confirmed = await apiRequest(
    baseUrl,
    'POST',
    `/api/v1/requests/${requestId}/offers/${offerId}/confirm`,
    { token: customerToken },
  );
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.data.request.status, 'ACCEPTED');

  const cancelled = await apiRequest(baseUrl, 'POST', `/api/v1/requests/${requestId}/cancel`, {
    token: customerToken,
    body: { reason: 'Integration lifecycle cleanup' },
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, 'CANCELLED');

  const stored = await db.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  assert.equal(stored.status, 'CANCELLED');
  assert.equal(stored.activeJobKey, null);
  assert.equal(await db.requestOffer.count({
    where: { requestId, status: { in: ['SUBMITTED', 'DISCUSSING'] } },
  }), 0);
});

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 3_000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, value => {
      clearTimeout(timer);
      resolve(value as T);
    });
  });
}

async function connectSocket(token: string) {
  const socket = createSocket(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  await waitForEvent(socket, 'connect');
  return socket;
}

test('Socket.IO enforces room authorization, validation, persistence, rate limits, and revocation', async () => {
  await resetIntegrationState();
  const category = await createCategory('Socket integration');
  const customer = await createUser('CUSTOMER', 'socket-customer');
  const worker = await createWorker(category.id, 'socket-worker');
  const intruder = await createWorker(category.id, 'socket-intruder');
  const request = await createRequestFixture(customer.id, category.id);
  await db.serviceRequest.update({
    where: { id: request.id },
    data: { status: 'ACCEPTED', workerId: worker.worker.id },
  });
  const customerToken = (await createAccessSession(customer.id)).accessToken;
  const workerToken = (await createAccessSession(worker.user.id)).accessToken;
  const intruderToken = (await createAccessSession(intruder.user.id)).accessToken;
  const customerSocket = await connectSocket(customerToken);
  const workerSocket = await connectSocket(workerToken);
  const intruderSocket = await connectSocket(intruderToken);

  try {
    const customerJoined = waitForEvent(customerSocket, 'chat:joined');
    customerSocket.emit('chat:join', request.id);
    assert.equal((await customerJoined as { requestId: string }).requestId, request.id);

    const workerJoined = waitForEvent(workerSocket, 'chat:joined');
    workerSocket.emit('chat:join', request.id);
    await workerJoined;

    const forbidden = waitForEvent<{ code: string }>(intruderSocket, 'chat:error');
    intruderSocket.emit('chat:join', request.id);
    assert.equal((await forbidden).code, 'CHAT_FORBIDDEN');

    const delivered = waitForEvent<{ message: { content: string } }>(customerSocket, 'chat:message');
    workerSocket.emit('chat:message', { requestId: request.id, content: 'Persist this message' });
    assert.equal((await delivered).message.content, 'Persist this message');
    assert.equal(await db.message.count({ where: { requestId: request.id } }), 1);

    const invalid = waitForEvent<{ code: string }>(workerSocket, 'chat:error');
    workerSocket.emit('chat:message', { requestId: request.id, content: 'x'.repeat(2001) });
    assert.equal((await invalid).code, 'INVALID_MESSAGE');

    const limited = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Message rate limit was not enforced')), 5_000);
      const listener = (error: { code?: string }) => {
        if (error.code === 'MESSAGE_RATE_LIMITED') {
          clearTimeout(timer);
          workerSocket.off('chat:error', listener);
          resolve();
        }
      };
      workerSocket.on('chat:error', listener);
    });
    for (let index = 0; index < 21; index += 1) {
      workerSocket.emit('chat:message', { requestId: 'invalid', content: 'rate-check' });
    }
    await limited;

    const disconnected = waitForEvent(workerSocket, 'disconnect');
    await revokeSession(worker.user.id);
    workerSocket.emit('chat:leave', request.id);
    await disconnected;
    assert.equal(workerSocket.connected, false);
  } finally {
    customerSocket.disconnect();
    workerSocket.disconnect();
    intruderSocket.disconnect();
  }
});

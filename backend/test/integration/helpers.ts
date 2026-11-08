import crypto from 'crypto';
import { PaymentMethod, UserRole } from '@prisma/client';
import { db } from '../../src/config/database';
import { createSession, redis } from '../../src/config/redis';
import { hashPassword } from '../../src/utils/bcrypt';
import { signAccessToken, signRefreshToken } from '../../src/utils/jwt';

export const TEST_PASSWORD = 'Password1';

export function assertIsolatedTestEnvironment() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  const redisUrl = new URL(process.env.REDIS_URL ?? '');
  const localHosts = new Set(['127.0.0.1', 'localhost', 'postgres', 'worker-test-postgres']);
  if (process.env.NODE_ENV !== 'test') throw new Error('Integration tests require NODE_ENV=test.');
  if (!localHosts.has(database.hostname) || !database.pathname.toLowerCase().endsWith('_test')) {
    throw new Error('Refusing to clean a database that is not an isolated local *_test database.');
  }
  if (!localHosts.has(redisUrl.hostname) || redisUrl.pathname !== '/15') {
    throw new Error('Refusing to clean Redis outside local database 15.');
  }
}

export async function resetIntegrationState() {
  assertIsolatedTestEnvironment();
  await db.$transaction([
    db.offerMessage.deleteMany(),
    db.message.deleteMany(),
    db.notification.deleteMany(),
    db.review.deleteMany(),
    db.workerAcceptanceUsage.deleteMany(),
    db.payment.deleteMany(),
    db.requestImage.deleteMany(),
    db.requestOffer.deleteMany(),
    db.serviceRequest.deleteMany(),
    db.favorite.deleteMany(),
    db.workerAvailability.deleteMany(),
    db.workerCategory.deleteMany(),
    db.userSubscription.deleteMany(),
    db.worker.deleteMany(),
    db.serviceCategory.deleteMany(),
    db.subscriptionWebhookEvent.deleteMany(),
    db.user.deleteMany(),
  ]);
  if (redis.isOpen) await redis.flushDb();
}

export async function createCategory(name = `Integration ${crypto.randomUUID()}`) {
  return db.serviceCategory.create({ data: { name, isActive: true } });
}

export async function createUser(role: UserRole, label = role.toLowerCase()) {
  const suffix = crypto.randomUUID();
  return db.user.create({
    data: {
      fullName: `${label} integration`,
      email: `${label}-${suffix}@worker.test`,
      phone: `050${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      passwordHash: await hashPassword(TEST_PASSWORD),
      role,
      avatarUrl: 'https://example.com/integration-avatar.png',
      isVerified: true,
      isActive: true,
    },
  });
}

export async function createWorker(categoryId: string, label = 'worker') {
  const user = await createUser('WORKER', label);
  const worker = await db.worker.create({
    data: {
      userId: user.id,
      bio: 'Experienced integration test worker for reliable home services.',
      yearsExp: 4,
      hourlyRate: 120,
      isAvailable: true,
      approvedAt: new Date(),
      primaryServiceCity: 'haifa',
      categories: { create: { categoryId } },
      availability: {
        create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          startTime: '00:00',
          endTime: '23:59',
        })),
      },
    },
  });
  return { user, worker };
}

export async function createRequestFixture(customerId: string, categoryId: string) {
  return db.serviceRequest.create({
    data: {
      customerId,
      categoryId,
      title: 'Integration service request',
      description: 'Integration request used to verify privacy and concurrency behavior.',
      status: 'PENDING',
      address: '10 Private Street, Haifa',
      serviceCity: 'haifa',
      lat: 32.794,
      lng: 34.9896,
      scheduledAt: new Date(Date.now() + 86_400_000),
      paymentMethod: PaymentMethod.CASH,
      activeJobKey: `integration-${crypto.randomUUID()}`,
    },
  });
}

export async function createAccessSession(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const sid = crypto.randomUUID();
  const identity = { sub: user.id, sid, role: user.role, email: user.email };
  const accessToken = signAccessToken(identity);
  const refreshToken = signRefreshToken({ sub: user.id, sid });
  await createSession(user.id, sid, refreshToken, 3_600);
  return { accessToken, refreshToken };
}

export async function apiRequest(
  baseUrl: string,
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
    },
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

export function offerInput(index = 1) {
  return {
    proposedPrice: 100 + index,
    estimatedDuration: 60,
    availableAt: new Date(Date.now() + 3_600_000 + index * 1000).toISOString(),
    message: `Integration offer ${index}`,
  };
}

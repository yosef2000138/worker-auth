import test from 'node:test';
import assert from 'node:assert/strict';
import { listNotificationsSchema } from '../modules/notifications/notifications.schema';
import { updateStatusSchema } from '../modules/requests/requests.schema';
import { requestHistorySchema, updateProfileSchema } from '../modules/users/users.schema';
import { setAvailabilitySchema, setCategoriesSchema } from '../modules/workers/workers.schema';

const requestId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';

test('history pagination is bounded and rejects unexpected query fields', () => {
  assert.equal(requestHistorySchema.safeParse({ query: { page: '1', limit: '50' } }).success, true);
  assert.equal(requestHistorySchema.safeParse({ query: { page: '1', limit: '500' } }).success, false);
  assert.equal(requestHistorySchema.safeParse({ query: { page: '1', extra: 'value' } }).success, false);
});

test('notification unread filter preserves explicit false and rejects invalid values', () => {
  const parsed = listNotificationsSchema.parse({ query: { unreadOnly: 'false' } });
  assert.equal(parsed.query.unreadOnly, false);
  assert.equal(listNotificationsSchema.safeParse({ query: { unreadOnly: 'sometimes' } }).success, false);
});

test('profile and status mutations reject over-posted fields', () => {
  assert.equal(updateProfileSchema.safeParse({ body: { fullName: 'Valid User', role: 'ADMIN' } }).success, false);
  assert.equal(updateStatusSchema.safeParse({
    params: { id: requestId },
    body: { status: 'CANCELLED', customerId: requestId },
  }).success, false);
});

test('profile input rejects empty normalized names and oversized avatar URLs', () => {
  assert.equal(updateProfileSchema.safeParse({ body: { fullName: '   ' } }).success, false);
  assert.equal(updateProfileSchema.safeParse({
    body: { avatarUrl: `https://example.com/${'a'.repeat(2048)}` },
  }).success, false);
});

test('worker availability validates real times and limits payload size', () => {
  assert.equal(setAvailabilitySchema.safeParse({
    body: { slots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }] },
  }).success, true);
  assert.equal(setAvailabilitySchema.safeParse({
    body: { slots: [{ dayOfWeek: 1, startTime: '99:00', endTime: '18:00' }] },
  }).success, false);
  assert.equal(setAvailabilitySchema.safeParse({
    body: { slots: [{ dayOfWeek: 1, startTime: '18:00', endTime: '09:00' }] },
  }).success, false);
  assert.equal(setAvailabilitySchema.safeParse({
    body: { slots: Array.from({ length: 22 }, () => ({ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' })) },
  }).success, false);
});

test('worker category mutation rejects duplicate identifiers', () => {
  assert.equal(setCategoriesSchema.safeParse({ body: { categoryIds: [categoryId, categoryId] } }).success, false);
});

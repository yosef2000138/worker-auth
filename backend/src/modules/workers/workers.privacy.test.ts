import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toAssignedCustomerWorkerProfile,
  toPublicWorkerProfile,
} from './workers.service';

test('public worker profile removes contact details and exact base coordinates', () => {
  const result = toPublicWorkerProfile({
    id: 'worker-profile-1',
    bio: 'Professional worker',
    baseLatitude: 32.08,
    baseLongitude: 34.78,
    user: {
      id: 'worker-user-1',
      fullName: 'Demo Worker',
      avatarUrl: 'https://example.com/avatar.jpg',
      email: 'private@example.com',
      phone: '0500000000',
    },
  });

  assert.equal('baseLatitude' in result, false);
  assert.equal('baseLongitude' in result, false);
  assert.equal('email' in result.user, false);
  assert.equal('phone' in result.user, false);
  assert.equal(result.user.fullName, 'Demo Worker');
});

test('assigned customer profile keeps job phone but removes email and exact base coordinates', () => {
  const result = toAssignedCustomerWorkerProfile({
    id: 'worker-profile-1',
    bio: 'Professional worker',
    baseLatitude: 32.08,
    baseLongitude: 34.78,
    user: {
      id: 'worker-user-1',
      fullName: 'Demo Worker',
      avatarUrl: 'https://example.com/avatar.jpg',
      email: 'private@example.com',
      phone: '0500000000',
    },
  });

  assert.equal('baseLatitude' in result, false);
  assert.equal('baseLongitude' in result, false);
  assert.equal('email' in result.user, false);
  assert.equal(result.user.phone, '0500000000');
});

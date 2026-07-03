import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_DUPLICATE_REQUEST_STATUSES,
  duplicateActiveRequestError,
} from './requests.service';

test('duplicate active request detection covers active customer request states', () => {
  assert.deepEqual(ACTIVE_DUPLICATE_REQUEST_STATUSES, ['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS']);
});

test('duplicate active request error returns a stable code and existing request id', () => {
  const error = duplicateActiveRequestError({
    id: 'd7d53d86-a250-4443-b8a9-829be83c2869',
    status: 'PENDING',
  });

  assert.equal(error.status, 409);
  assert.equal(error.code, 'DUPLICATE_ACTIVE_REQUEST');
  assert.deepEqual(error.details, {
    id: 'd7d53d86-a250-4443-b8a9-829be83c2869',
    status: 'PENDING',
  });
});

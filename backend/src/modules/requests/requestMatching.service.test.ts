import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_OFFER_STATUSES } from './requestMatching.service';

test('active offer statuses are exactly submitted and discussing', () => {
  assert.deepEqual([...ACTIVE_OFFER_STATUSES].sort(), ['DISCUSSING', 'SUBMITTED']);
});

test('closed offer statuses do not occupy active offer slots', () => {
  const closedStatuses = ['SELECTED', 'NOT_SELECTED', 'WITHDRAWN', 'EXPIRED'];

  for (const status of closedStatuses) {
    assert.equal(ACTIVE_OFFER_STATUSES.includes(status as never), false, `${status} should release the active slot`);
  }
});

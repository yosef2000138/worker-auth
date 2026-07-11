import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_DUPLICATE_REQUEST_STATUSES,
  TERMINAL_REQUEST_STATUSES,
  buildActiveJobKey,
  buildRequestLocationBucket,
  distanceKm,
  duplicateActiveRequestError,
  normalizeRequestAddress,
  normalizeRequestText,
} from './requests.service';
import { serializeRequestForViewer } from './requestPrivacy';
import { assertOfferParticipant } from './offers.service';

test('duplicate active request detection covers active customer request states', () => {
  assert.deepEqual(ACTIVE_DUPLICATE_REQUEST_STATUSES, ['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS']);
});

test('duplicate active request detection covers terminal request states', () => {
  assert.deepEqual(TERMINAL_REQUEST_STATUSES, ['COMPLETED', 'CANCELLED']);
});

test('duplicate active request error returns a stable code and existing request id', () => {
  const error = duplicateActiveRequestError({
    id: 'd7d53d86-a250-4443-b8a9-829be83c2869',
    status: 'PENDING',
  });

  assert.equal(error.status, 409);
  assert.equal(error.code, 'DUPLICATE_ACTIVE_REQUEST');
  assert.deepEqual(error.details, {
    existingRequestId: 'd7d53d86-a250-4443-b8a9-829be83c2869',
    existingRequestStatus: 'PENDING',
  });
});

test('request text normalization is stable for duplicate keys', () => {
  assert.equal(normalizeRequestText('  Fix   The Sink  '), 'fix the sink');
});

test('request address normalization is stable for duplicate checks', () => {
  assert.equal(normalizeRequestAddress('  10 Exact   Street, Tel Aviv  '), '10 exact street, tel aviv');
});

test('active job key uses no-location bucket when location is missing', () => {
  const key = buildActiveJobKey({
    customerId: 'customer-1',
    categoryId: 'category-1',
    title: ' Fix   leaking sink ',
    description: ' Water under  the cabinet ',
  });

  assert.equal(key, 'customer-1|category-1|fix leaking sink|water under the cabinet|NO_LOCATION');
});

test('active job key uses category id and not translated category label', () => {
  const first = buildActiveJobKey({
    customerId: 'customer-1',
    categoryId: 'category-id',
    title: 'Fix sink',
    description: 'Water under cabinet',
  });
  const second = buildActiveJobKey({
    customerId: 'customer-1',
    categoryId: 'category-id',
    title: 'Fix sink',
    description: 'Water under cabinet',
  });

  assert.equal(first, second);
  assert.equal(first.includes('Plumbing'), false);
});

test('active job key changes for different customer and category', () => {
  const base = {
    customerId: 'customer-1',
    categoryId: 'category-1',
    title: 'Fix sink',
    description: 'Water under cabinet',
  };

  assert.notEqual(buildActiveJobKey(base), buildActiveJobKey({ ...base, customerId: 'customer-2' }));
  assert.notEqual(buildActiveJobKey(base), buildActiveJobKey({ ...base, categoryId: 'category-2' }));
});

test('location bucket normalizes address and coordinate values', () => {
  assert.equal(buildRequestLocationBucket({ address: '  10 Exact   Street, Tel Aviv ' }), 'ADDR:10 exact street, tel aviv');
  assert.equal(buildRequestLocationBucket({ lat: 32.08531, lng: 34.78182 }), 'COORD:32.085,34.782');
  assert.equal(buildRequestLocationBucket({ lat: 0, lng: 0 }), 'NO_LOCATION');
});

test('distance helper supports threshold based duplicate checks', () => {
  const near = distanceKm({ lat: 32.0853, lng: 34.7818 }, { lat: 32.086, lng: 34.782 });
  const far = distanceKm({ lat: 32.0853, lng: 34.7818 }, { lat: 31.7683, lng: 35.2137 });

  assert.equal(near < 0.2, true);
  assert.equal(far > 0.2, true);
});

function mockRequest(): any {
  return {
    id: 'request-1',
    title: 'Electrical help',
    description: 'Need help with an outlet',
    status: 'PENDING',
    lat: 32.0853,
    lng: 34.7818,
    address: '10 Exact Street, Tel Aviv',
    scheduledAt: null,
    priceAgreed: null,
    paymentMethod: 'CASH',
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { id: 'electrical', name: 'Electrical', icon: null },
    images: [],
    customer: {
      id: 'customer-user-1',
      fullName: 'Customer One',
      avatarUrl: 'https://example.com/customer.png',
      phone: '+972500000000',
    },
    worker: {
      id: 'worker-1',
      ratingAvg: 4.5,
      totalReviews: 3,
      user: {
        id: 'worker-user-1',
        fullName: 'Worker One',
        avatarUrl: null,
        phone: '+972511111111',
      },
    },
    review: null,
    offerCount: 0,
    maxOffers: 5,
    offersOpen: true,
  };
}

test('unselected worker receives public pending request data only', () => {
  const request = { ...mockRequest(), worker: null };
  const serialized = serializeRequestForViewer(request, {
    userId: 'worker-user-2',
    role: 'WORKER',
    workerId: 'worker-2',
  }) as {
    customer?: unknown;
    address?: string;
    lat?: number;
    lng?: number;
  };

  assert.equal(serialized.customer, undefined);
  assert.notEqual(serialized.address, '10 Exact Street, Tel Aviv');
  assert.equal(serialized.address, 'Tel Aviv');
  assert.equal(serialized.lat, undefined);
  assert.equal(serialized.lng, undefined);
});

test('owning customer receives private request details', () => {
  const request = mockRequest();
  const serialized = serializeRequestForViewer(request, {
    userId: 'customer-user-1',
    role: 'CUSTOMER',
  }) as {
    customer?: { phone?: string | null };
    address?: string;
    lat?: number;
    lng?: number;
  };

  assert.equal(serialized.customer?.phone, '+972500000000');
  assert.equal(serialized.address, '10 Exact Street, Tel Aviv');
  assert.equal(serialized.lat, 32.0853);
  assert.equal(serialized.lng, 34.7818);
});

test('assigned worker receives private job details', () => {
  const request = mockRequest();
  const serialized = serializeRequestForViewer(request, {
    userId: 'worker-user-1',
    role: 'WORKER',
    workerId: 'worker-1',
  }) as {
    customer?: { phone?: string | null };
    address?: string;
    lat?: number;
    lng?: number;
  };

  assert.equal(serialized.customer?.phone, '+972500000000');
  assert.equal(serialized.address, '10 Exact Street, Tel Aviv');
  assert.equal(serialized.lat, 32.0853);
  assert.equal(serialized.lng, 34.7818);
});

test('unselected offer worker does not receive private request details', () => {
  const request = { ...mockRequest(), worker: null, hasMyOffer: true, myOfferId: 'offer-1', myOfferStatus: 'SUBMITTED' };
  const serialized = serializeRequestForViewer(request, {
    userId: 'worker-user-2',
    role: 'WORKER',
    workerId: 'worker-2',
  }) as {
    customer?: unknown;
    address?: string;
    lat?: number;
    lng?: number;
  };

  assert.equal(serialized.customer, undefined);
  assert.equal(serialized.address, 'Tel Aviv');
  assert.equal(serialized.lat, undefined);
  assert.equal(serialized.lng, undefined);
});

test('offer chat allows only owning customer or the offer worker', () => {
  const offer = {
    request: { customerId: 'customer-user-1' },
    worker: { userId: 'worker-user-1' },
  } as any;

  assert.deepEqual(assertOfferParticipant(offer, 'customer-user-1'), { isCustomer: true, isWorker: false });
  assert.deepEqual(assertOfferParticipant(offer, 'worker-user-1'), { isCustomer: false, isWorker: true });
  assert.throws(
    () => assertOfferParticipant(offer, 'worker-user-2'),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 403);
      assert.equal((error as { code?: string }).code, 'OFFER_NOT_ACCESSIBLE');
      return true;
    },
  );
});

import { RequestStatus, Prisma } from '@prisma/client';
import { db } from '../../config/database';
import { uploadBuffer } from '../../config/cloudinary';
import { pushToUser } from '../../utils/fcm';
import { WorkerAcceptanceAccess } from '../subscriptions/subscriptions.service';
import { closeOffersForCancelledRequest } from './offers.service';
import {
  ACTIVE_OFFER_STATUSES,
  addOfferMetaToRequests,
  buildIncomingRequestWhereForWorker,
  notifyEligibleWorkersForRequest,
  workerMatchesSchedule,
} from './requestMatching.service';
import {
  requestSelect,
  serializeRequestForViewer,
  serializeRequestsForViewer,
} from './requestPrivacy';

export const ACTIVE_DUPLICATE_REQUEST_STATUSES: RequestStatus[] = ['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'];
export const TERMINAL_REQUEST_STATUSES: RequestStatus[] = ['COMPLETED', 'CANCELLED'];
const DUPLICATE_DISTANCE_KM = 0.2;
const COORDINATE_BUCKET_PRECISION = 3;

// ─── FSM ─────────────────────────────────────────────────────────────────────
type Actor = 'CUSTOMER' | 'WORKER';

const TRANSITIONS: Record<
  RequestStatus,
  { next: RequestStatus; by: Actor }[]
> = {
  PENDING:     [{ next: 'CANCELLED', by: 'CUSTOMER' }],
  ACCEPTED:    [{ next: 'ON_THE_WAY',  by: 'WORKER'   }, { next: 'CANCELLED', by: 'CUSTOMER' }, { next: 'CANCELLED', by: 'WORKER' }],
  ON_THE_WAY:  [{ next: 'IN_PROGRESS', by: 'WORKER'   }, { next: 'CANCELLED', by: 'CUSTOMER' }],
  IN_PROGRESS: [{ next: 'COMPLETED',   by: 'WORKER'   }],
  COMPLETED:   [],
  CANCELLED:   [],
};

function assertTransition(current: RequestStatus, next: RequestStatus, by: Actor) {
  const allowed = TRANSITIONS[current].some((t) => t.next === next && t.by === by);
  if (!allowed) {
    throw {
      status: 422,
      message: `Transition ${current} → ${next} is not allowed for ${by}`,
    };
  }
}

export type RequestStatusUpdateResult =
  | Prisma.ServiceRequestGetPayload<{ select: typeof requestSelect }>
  | {
    request: Prisma.ServiceRequestGetPayload<{ select: typeof requestSelect }>;
    workerAccess: WorkerAcceptanceAccess;
  };

function pushStatusNotification(
  id: string,
  request: { customerId: string; worker?: { userId?: string } | null },
  role: Actor,
  newStatus: RequestStatus,
  cancellationReason?: string,
) {
  const notifyTarget: Partial<
    Record<RequestStatus, { to: string; title: string; body: string }>
  > = {
    ACCEPTED:    { to: request.customerId, title: 'Request accepted!',  body: 'A worker has accepted your request.' },
    ON_THE_WAY:  { to: request.customerId, title: 'Worker on the way',  body: 'Your worker is heading to you now.' },
    IN_PROGRESS: { to: request.customerId, title: 'Job started',        body: 'Your service is now in progress.' },
    COMPLETED:   { to: request.customerId, title: 'Job completed ✅',   body: 'Please leave a review for your worker.' },
    CANCELLED: {
      to:
        role === 'CUSTOMER'
          ? request.worker?.userId ?? ''
          : request.customerId,
      title: 'Request cancelled',
      body: cancellationReason ?? 'The request has been cancelled.',
    },
  };

  const notif = notifyTarget[newStatus];
  if (notif?.to) {
    pushToUser(notif.to, notif.title, notif.body, { requestId: id }).catch(() => {});
  }
}

export function duplicateActiveRequestError(duplicate: { id: string; status: RequestStatus }) {
  return {
    status: 409,
    code: 'DUPLICATE_ACTIVE_REQUEST',
    message: 'You already have an active request for this service.',
    details: {
      existingRequestId: duplicate.id,
      existingRequestStatus: duplicate.status,
    },
  };
}

export function normalizeRequestText(value?: string | null) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeRequestAddress(address?: string | null) {
  return normalizeRequestText(address);
}

function coordinateBucket(lat: number, lng: number) {
  const multiplier = 10 ** COORDINATE_BUCKET_PRECISION;
  const roundedLat = Math.round(lat * multiplier) / multiplier;
  const roundedLng = Math.round(lng * multiplier) / multiplier;
  return `COORD:${roundedLat.toFixed(COORDINATE_BUCKET_PRECISION)},${roundedLng.toFixed(COORDINATE_BUCKET_PRECISION)}`;
}

export function buildRequestLocationBucket(input: { address?: string | null; lat?: number | null; lng?: number | null }) {
  const normalizedAddress = normalizeRequestAddress(input.address);
  if (normalizedAddress) return `ADDR:${normalizedAddress}`;
  if (input.lat != null && input.lng != null && !(input.lat === 0 && input.lng === 0)) {
    return coordinateBucket(input.lat, input.lng);
  }
  return 'NO_LOCATION';
}

export function buildActiveJobKey(input: {
  customerId: string;
  categoryId: string;
  title: string;
  description: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  return [
    input.customerId,
    input.categoryId,
    normalizeRequestText(input.title),
    normalizeRequestText(input.description),
    buildRequestLocationBucket(input),
  ].join('|');
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function findActiveDuplicateByJobKey(activeJobKey: string) {
  return db.serviceRequest.findFirst({
    where: {
      activeJobKey,
      status: { in: ACTIVE_DUPLICATE_REQUEST_STATUSES },
    },
    select: { id: true, status: true },
  });
}

function activeJobKeyForStatus(status: RequestStatus) {
  return TERMINAL_REQUEST_STATUSES.includes(status) ? null : undefined;
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function isSameDuplicateLocation(
  existing: { address?: string | null; lat?: number | null; lng?: number | null },
  next: { address?: string | null; lat?: number | null; lng?: number | null },
) {
  const normalizedExistingAddress = normalizeRequestAddress(existing.address);
  const normalizedNextAddress = normalizeRequestAddress(next.address);
  if (normalizedExistingAddress && normalizedNextAddress && normalizedExistingAddress === normalizedNextAddress) return true;
  if (existing.lat == null || existing.lng == null || next.lat == null || next.lng == null) return false;
  if ((existing.lat === 0 && existing.lng === 0) || (next.lat === 0 && next.lng === 0)) return false;
  return distanceKm(
    { lat: existing.lat, lng: existing.lng },
    { lat: next.lat, lng: next.lng },
  ) <= DUPLICATE_DISTANCE_KM;
}

async function addWorkerOfferState<T extends { id: string }>(items: T[], workerId: string) {
  if (items.length === 0) return items;
  const offers = await db.requestOffer.findMany({
    where: {
      workerId,
      requestId: { in: items.map(item => item.id) },
    },
    select: { id: true, requestId: true, status: true },
  });
  const offerByRequest = new Map(
    offers
      .filter(offer => ACTIVE_OFFER_STATUSES.includes(offer.status))
      .map(offer => [offer.requestId, offer]),
  );

  return items.map(item => {
    const offer = offerByRequest.get(item.id);
    return {
      ...item,
      hasMyOffer: Boolean(offer),
      myOfferId: offer?.id ?? null,
      myOfferStatus: offer?.status ?? null,
    };
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createRequest(
  customerId: string,
  body: {
    categoryId: string;
    title: string;
    description: string;
    lat?: number | null;
    lng?: number | null;
    address?: string | null;
    scheduledAt?: string;
    paymentMethod: 'ONLINE' | 'CASH';
  },
  files: Express.Multer.File[],
) {
  const category = await db.serviceCategory.findUnique({
    where: { id: body.categoryId, isActive: true },
  });
  if (!category) throw { status: 404, message: 'Service category not found' };

  const activeRequests = await db.serviceRequest.findMany({
    where: {
      customerId,
      categoryId: body.categoryId,
      status: { in: ACTIVE_DUPLICATE_REQUEST_STATUSES },
    },
    select: { id: true, status: true, address: true, lat: true, lng: true, activeJobKey: true },
  });
  const activeJobKey = buildActiveJobKey({ customerId, ...body });
  const duplicate = activeRequests.find(item => item.activeJobKey === activeJobKey || isSameDuplicateLocation(item, body));
  if (duplicate) {
    throw duplicateActiveRequestError(duplicate);
  }

  const imageUrls =
    files.length > 0
      ? await Promise.all(files.map((f) => uploadBuffer(f.buffer, 'worker/requests')))
      : [];

  let request: Prisma.ServiceRequestGetPayload<{ select: typeof requestSelect }>;
  try {
    request = await db.serviceRequest.create({
      data: {
        customerId,
        categoryId: body.categoryId,
        title: body.title,
        description: body.description,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        address: body.address?.trim() || null,
        activeJobKey,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        paymentMethod: body.paymentMethod,
        images: {
          create: imageUrls.map((url, order) => ({ imageUrl: url, order })),
        },
      },
      select: requestSelect,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const concurrentDuplicate = await findActiveDuplicateByJobKey(activeJobKey);
      if (concurrentDuplicate) throw duplicateActiveRequestError(concurrentDuplicate);
    }
    throw error;
  }

  void notifyEligibleWorkersForRequest({
    id: request.id,
    customerId,
    categoryId: body.categoryId,
    title: request.title,
    scheduledAt: request.scheduledAt,
    category: request.category,
  }).catch(() => {});

  const [requestWithMeta] = await addOfferMetaToRequests(db, [request]);
  return requestWithMeta;
}

// ─── List ─────────────────────────────────────────────────────────────────────
export async function listRequests(
  userId: string,
  role: Actor,
  query: { status?: RequestStatus; page: number; limit: number },
) {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  let where: Prisma.ServiceRequestWhereInput;
  let workerIdForOfferState: string | null = null;
  let workerForViewer: { id: string; availability: { dayOfWeek: number; startTime: string; endTime: string }[] } | null = null;

  if (role === 'CUSTOMER') {
    where = { customerId: userId, ...(status && { status }) };
  } else {
    const worker = await db.worker.findUnique({
      where: { userId },
      select: {
        id: true,
        availability: { select: { dayOfWeek: true, startTime: true, endTime: true } },
      },
    });

    if (!worker) {
      return {
        items: [],
        pagination: { total: 0, page, limit, pages: 0 },
      };
    }

    workerForViewer = worker;
    workerIdForOfferState = worker.id;
    const openForOffer = await buildIncomingRequestWhereForWorker(db, userId);
    const impossibleWhere: Prisma.ServiceRequestWhereInput = { id: '__no_matching_requests__' };

    where = status === 'PENDING'
      ? openForOffer ?? impossibleWhere
      : status
      ? { worker: { userId }, status }
      : {
          OR: [
            ...(openForOffer ? [openForOffer] : []),
            { worker: { userId } },
            { offers: { some: { workerId: worker.id } } },
          ],
        };
    if (status === 'PENDING') {
      const candidates = await db.serviceRequest.findMany({
        where,
        select: requestSelect,
        orderBy: { createdAt: 'desc' },
      });
      const scheduledCandidates = candidates.filter(item => workerMatchesSchedule(worker, item.scheduledAt));
      const itemsWithOfferMeta = await addOfferMetaToRequests(db, scheduledCandidates);
      const itemsWithViewerOfferState = await addWorkerOfferState(itemsWithOfferMeta, workerIdForOfferState);
      const filteredItems = itemsWithViewerOfferState.filter(item => {
        if (item.worker) return true;
        if ('hasMyOffer' in item && item.hasMyOffer) return true;
        return item.offerCount < item.maxOffers;
      });
      const pageItems = filteredItems.slice(skip, skip + limit);

      return {
        items: serializeRequestsForViewer(pageItems, { userId, role, workerId: workerIdForOfferState }),
        pagination: { total: filteredItems.length, page, limit, pages: Math.ceil(filteredItems.length / limit) },
      };
    }
  }

  const [total, items] = await Promise.all([
    db.serviceRequest.count({ where }),
    db.serviceRequest.findMany({
      where,
      select: requestSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const decoratedItems = role === 'CUSTOMER'
    ? items.map(item => ({
      ...item,
      canReview: item.status === 'COMPLETED' && Boolean(item.worker) && !item.review && item.worker?.user.id !== userId,
    }))
    : items;
  const itemsWithOfferMeta = await addOfferMetaToRequests(db, decoratedItems);
  const itemsWithViewerOfferState = role === 'WORKER' && workerIdForOfferState
    ? await addWorkerOfferState(itemsWithOfferMeta, workerIdForOfferState)
    : itemsWithOfferMeta;
  const finalItems = role === 'WORKER'
    ? itemsWithViewerOfferState.filter(item => {
      if (item.status !== 'PENDING' || item.worker) return true;
      if ('hasMyOffer' in item && item.hasMyOffer) return true;
      return item.offerCount < item.maxOffers;
    })
    : itemsWithViewerOfferState;
  const totalForResponse = role === 'WORKER' && status === 'PENDING' ? finalItems.length : total;

  return {
    items: serializeRequestsForViewer(finalItems, { userId, role, workerId: workerForViewer?.id ?? workerIdForOfferState }),
    pagination: { total: totalForResponse, page, limit, pages: Math.ceil(totalForResponse / limit) },
  };
}

// ─── Get one ──────────────────────────────────────────────────────────────────
export async function getRequest(id: string, userId: string, role: string) {
  const request = await db.serviceRequest.findUnique({
    where: { id },
    select: requestSelect,
  });
  if (!request) throw { status: 404, message: 'Request not found' };

  if (role === 'CUSTOMER' && request.customer.id !== userId) {
    throw { status: 403, message: 'Not your request' };
  }
  let viewerWorkerId: string | null = null;
  if (role === 'WORKER') {
    const worker = await db.worker.findUnique({
      where: { userId },
      select: {
        id: true,
        availability: { select: { dayOfWeek: true, startTime: true, endTime: true } },
      },
    });
    if (!worker) throw { status: 404, message: 'Worker profile not found' };
    viewerWorkerId = worker.id;

    const isAssignedWorker = request.worker?.user.id === userId;
    const hasOffer = await db.requestOffer.findFirst({
      where: { requestId: id, workerId: worker.id },
      select: { id: true },
    });
    let isOpenIncomingRequest = false;
    if (!isAssignedWorker && !hasOffer && request.status === 'PENDING' && !request.worker) {
      const incomingWhere = await buildIncomingRequestWhereForWorker(db, userId);
      if (incomingWhere) {
        const eligibleRequest = await db.serviceRequest.findFirst({
          where: { AND: [{ id }, incomingWhere] },
          select: { id: true },
        });
        isOpenIncomingRequest = Boolean(eligibleRequest) && workerMatchesSchedule(worker, request.scheduledAt);
      }
    }

    if (!isAssignedWorker && !isOpenIncomingRequest && !hasOffer) {
      throw { status: 403, message: 'You cannot access this request' };
    }
  }

  const requestWithReviewState = {
    ...request,
    canReview: role === 'CUSTOMER'
      && request.customer.id === userId
      && request.status === 'COMPLETED'
      && Boolean(request.worker)
      && !request.review
      && request.worker?.user.id !== userId,
  };
  const [requestWithOfferMeta] = await addOfferMetaToRequests(db, [requestWithReviewState]);
  return serializeRequestForViewer(requestWithOfferMeta, { userId, role, workerId: viewerWorkerId });
}

// ─── Update status ────────────────────────────────────────────────────────────
export async function updateStatus(
  id: string,
  userId: string,
  role: Actor,
  newStatus: RequestStatus,
  cancellationReason?: string,
): Promise<RequestStatusUpdateResult> {
  const request = await db.serviceRequest.findUnique({
    where: { id },
    include: {
      customer: true,
      worker: { include: { user: true } },
    },
  });
  if (!request) throw { status: 404, message: 'Request not found' };

  if (role === 'CUSTOMER' && request.customerId !== userId) {
    throw { status: 403, message: 'Not your request' };
  }
  if (role === 'WORKER') {
    const isAssigned = request.worker?.userId === userId;
    if (newStatus === 'ACCEPTED') {
      throw {
        status: 409,
        code: 'CUSTOMER_CONFIRMATION_REQUIRED',
        message: 'Workers can send offers, but only the customer can choose and accept one.',
      };
    }
    if (!isAssigned) {
      throw { status: 403, message: 'You are not assigned to this request' };
    }
  }

  assertTransition(request.status, newStatus, role);

  const updated = await db.serviceRequest.update({
    where: { id },
    data: {
      status: newStatus,
      activeJobKey: activeJobKeyForStatus(newStatus),
    },
    select: requestSelect,
  });

  // Increment completed jobs counter
  if (newStatus === 'COMPLETED' && request.worker) {
    await db.worker.update({
      where: { id: request.worker.id },
      data: { totalJobs: { increment: 1 } },
    });
  }

  if (newStatus === 'CANCELLED') {
    await closeOffersForCancelledRequest(id);
  }

  pushStatusNotification(id, request, role, newStatus, cancellationReason);

  const [updatedWithOfferMeta] = await addOfferMetaToRequests(db, [updated]);
  return updatedWithOfferMeta;
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
export async function cancelRequest(
  id: string,
  userId: string,
  role: Actor,
  reason?: string,
) {
  return updateStatus(id, userId, role, 'CANCELLED', reason);
}

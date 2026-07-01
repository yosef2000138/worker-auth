import { Prisma, RequestOfferStatus } from '@prisma/client';
import { db } from '../../config/database';
import { env } from '../../config/env';
import { getIO } from '../../sockets';
import { dispatchNotification } from '../../jobs/notificationJob';
import { getWorkerAcceptanceAccess, WorkerAcceptanceAccess } from '../subscriptions/subscriptions.service';
import { requestReviewSelect } from '../reviews/reviews.service';
import { CreateOfferInput, SendOfferMessageInput } from './requests.schema';
import {
  ACTIVE_OFFER_STATUSES,
  addOfferMetaToRequests,
  assertWorkerEligibleForRequest,
} from './requestMatching.service';

type ActorRole = 'CUSTOMER' | 'WORKER' | 'ADMIN';

const requestSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  lat: true,
  lng: true,
  address: true,
  scheduledAt: true,
  priceAgreed: true,
  paymentMethod: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, icon: true } },
  images: {
    select: { id: true, imageUrl: true, order: true },
    orderBy: { order: 'asc' as const },
  },
  customer: {
    select: { id: true, fullName: true, avatarUrl: true, phone: true },
  },
  worker: {
    select: {
      id: true,
      ratingAvg: true,
      totalReviews: true,
      totalJobs: true,
      user: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
    },
  },
  review: { select: requestReviewSelect },
} satisfies Prisma.ServiceRequestSelect;

const offerSelect = {
  id: true,
  requestId: true,
  workerId: true,
  proposedPrice: true,
  message: true,
  availableAt: true,
  estimatedDuration: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  worker: {
    select: {
      id: true,
      ratingAvg: true,
      totalReviews: true,
      totalJobs: true,
      hourlyRate: true,
      user: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.RequestOfferSelect;

const offerMessageSelect = {
  id: true,
  offerId: true,
  senderId: true,
  content: true,
  isRead: true,
  createdAt: true,
  sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
} satisfies Prisma.OfferMessageSelect;

export type RequestOfferDto = Prisma.RequestOfferGetPayload<{ select: typeof offerSelect }>;
export type OfferMessageDto = Prisma.OfferMessageGetPayload<{ select: typeof offerMessageSelect }>;

function apiError(status: number, code: string, message: string, details?: unknown) {
  return { status, code, message, ...(details !== undefined && { details }) };
}

function canMessage(status: RequestOfferStatus) {
  return status === 'SUBMITTED' || status === 'DISCUSSING' || status === 'SELECTED';
}

async function lockRequestOfferSlot(tx: Prisma.TransactionClient, requestId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${requestId}))`;
}

function emitToUser(userId: string, event: string, payload: unknown) {
  try {
    getIO().to(`user:${userId}`).emit(event, payload);
  } catch {
    // Socket.IO may be unavailable during tests or CLI scripts.
  }
}

export async function listOffers(requestId: string, userId: string, role: ActorRole) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, customerId: true, status: true, workerId: true },
  });
  if (!request) throw apiError(404, 'REQUEST_NOT_FOUND', 'Request not found');

  if (role === 'CUSTOMER') {
    if (request.customerId !== userId) throw apiError(403, 'NOT_YOUR_REQUEST', 'Not your request');
    const offers = await db.requestOffer.findMany({
      where: { requestId },
      select: offerSelect,
      orderBy: { createdAt: 'asc' },
    });
    const activeCount = await db.requestOffer.count({
      where: { requestId, status: { in: ACTIVE_OFFER_STATUSES } },
    });
    return {
      items: offers,
      limit: env.MAX_OFFERS_PER_REQUEST,
      count: activeCount,
      offersOpen: request.status === 'PENDING' && !request.workerId && activeCount < env.MAX_OFFERS_PER_REQUEST,
    };
  }

  if (role === 'WORKER') {
    const worker = await db.worker.findUnique({ where: { userId }, select: { id: true } });
    if (!worker) throw apiError(404, 'WORKER_PROFILE_NOT_FOUND', 'Worker profile not found');
    const offers = await db.requestOffer.findMany({
      where: { requestId, workerId: worker.id },
      select: offerSelect,
      orderBy: { createdAt: 'asc' },
    });
    const activeCount = await db.requestOffer.count({
      where: { requestId, status: { in: ACTIVE_OFFER_STATUSES } },
    });
    return {
      items: offers,
      limit: env.MAX_OFFERS_PER_REQUEST,
      count: activeCount,
      offersOpen: request.status === 'PENDING' && !request.workerId && activeCount < env.MAX_OFFERS_PER_REQUEST,
    };
  }

  throw apiError(403, 'OFFERS_NOT_ALLOWED', 'Offers are only available to customers and workers');
}

export async function createOffer(requestId: string, userId: string, input: CreateOfferInput) {
  try {
    const result = await db.$transaction(async (tx) => {
      await lockRequestOfferSlot(tx, requestId);

      const request = await tx.serviceRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          customerId: true,
          workerId: true,
          categoryId: true,
          status: true,
          scheduledAt: true,
        },
      });
      if (!request) throw apiError(404, 'REQUEST_NOT_FOUND', 'Request not found');
      if (request.customerId === userId) {
        throw apiError(403, 'WORKER_CANNOT_OFFER_OWN_REQUEST', 'You cannot submit an offer on your own request');
      }
      if (request.status !== 'PENDING' || request.workerId) {
        throw apiError(409, 'REQUEST_NOT_OPEN_FOR_OFFERS', 'Request is not open for offers');
      }

      const { worker, access } = await assertWorkerEligibleForRequest(tx, userId, request);

      const [existing, offerCount] = await Promise.all([
        tx.requestOffer.findFirst({
          where: { requestId, workerId: worker.id, status: { in: ACTIVE_OFFER_STATUSES } },
          select: { id: true },
        }),
        tx.requestOffer.count({
          where: { requestId, status: { in: ACTIVE_OFFER_STATUSES } },
        }),
      ]);

      if (existing) throw apiError(409, 'OFFER_ALREADY_EXISTS', 'You already have an active offer for this request');
      if (offerCount >= env.MAX_OFFERS_PER_REQUEST) {
        throw apiError(409, 'OFFER_LIMIT_REACHED', 'This request already has the maximum number of offers');
      }

      const offer = await tx.requestOffer.create({
        data: {
          requestId,
          workerId: worker.id,
          proposedPrice: input.proposedPrice,
          message: input.message,
          availableAt: input.availableAt ? new Date(input.availableAt) : undefined,
          estimatedDuration: input.estimatedDuration,
        },
        select: offerSelect,
      });

      return { offer, customerId: request.customerId, workerAccess: access };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    dispatchNotification({
      userId: result.customerId,
      type: 'NEW_OFFER_RECEIVED',
      title: 'New offer received',
      body: 'A worker sent an offer for your request.',
      data: { requestId, offerId: result.offer.id },
    }).catch(() => {});
    emitToUser(result.customerId, 'request.offer.created', result.offer);
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw apiError(409, 'OFFER_ALREADY_EXISTS', 'You already have an active offer for this request');
    }
    throw error;
  }
}

async function getOfferForAccess(requestId: string, offerId: string) {
  const offer = await db.requestOffer.findUnique({
    where: { id: offerId },
    include: {
      request: { select: { id: true, customerId: true, status: true, workerId: true } },
      worker: { select: { id: true, userId: true } },
    },
  });
  if (!offer || offer.requestId !== requestId) throw apiError(404, 'OFFER_NOT_FOUND', 'Offer not found');
  return offer;
}

function assertOfferParticipant(
  offer: Awaited<ReturnType<typeof getOfferForAccess>>,
  userId: string,
) {
  const isCustomer = offer.request.customerId === userId;
  const isWorker = offer.worker.userId === userId;
  if (!isCustomer && !isWorker) {
    throw apiError(403, 'OFFER_NOT_ACCESSIBLE', 'You cannot access this offer');
  }
  return { isCustomer, isWorker };
}

export async function listOfferMessages(
  requestId: string,
  offerId: string,
  userId: string,
  options: { before?: string; limit: number },
) {
  const offer = await getOfferForAccess(requestId, offerId);
  assertOfferParticipant(offer, userId);

  const messages = await db.offerMessage.findMany({
    where: {
      offerId,
      ...(options.before && { createdAt: { lt: new Date(options.before) } }),
    },
    select: offerMessageSelect,
    orderBy: { createdAt: 'desc' },
    take: options.limit,
  });

  await db.offerMessage.updateMany({
    where: { offerId, senderId: { not: userId }, isRead: false },
    data: { isRead: true },
  });

  return messages.reverse();
}

export async function sendOfferMessage(
  requestId: string,
  offerId: string,
  userId: string,
  input: SendOfferMessageInput,
) {
  const offer = await getOfferForAccess(requestId, offerId);
  const participant = assertOfferParticipant(offer, userId);
  if (offer.request.status === 'CANCELLED' || !canMessage(offer.status)) {
    throw apiError(423, 'OFFER_CONVERSATION_CLOSED', 'This offer conversation is closed');
  }

  const message = await db.$transaction(async (tx) => {
    if (offer.status === 'SUBMITTED') {
      await tx.requestOffer.update({
        where: { id: offerId },
        data: { status: 'DISCUSSING' },
      });
    }

    return tx.offerMessage.create({
      data: { offerId, senderId: userId, content: input.content },
      select: offerMessageSelect,
    });
  });

  const recipientId = participant.isCustomer ? offer.worker.userId : offer.request.customerId;
  dispatchNotification({
    userId: recipientId,
    type: 'NEW_OFFER_MESSAGE',
    title: 'New offer message',
    body: 'You have a new private message about an offer.',
    data: { requestId, offerId },
  }).catch(() => {});
  emitToUser(recipientId, 'request.offer.message.created', { requestId, offerId, message });
  return message;
}

export async function withdrawOffer(requestId: string, offerId: string, userId: string) {
  const offer = await getOfferForAccess(requestId, offerId);
  if (offer.worker.userId !== userId) {
    throw apiError(403, 'OFFER_NOT_ACCESSIBLE', 'You cannot withdraw this offer');
  }
  if (!ACTIVE_OFFER_STATUSES.includes(offer.status)) {
    throw apiError(409, 'OFFER_CANNOT_BE_WITHDRAWN', 'This offer can no longer be withdrawn');
  }

  const updated = await db.requestOffer.update({
    where: { id: offerId },
    data: { status: 'WITHDRAWN' },
    select: offerSelect,
  });

  dispatchNotification({
    userId: offer.request.customerId,
    type: 'OFFER_WITHDRAWN',
    title: 'Offer withdrawn',
    body: 'A worker withdrew their offer.',
    data: { requestId, offerId },
  }).catch(() => {});
  emitToUser(offer.request.customerId, 'request.offer.withdrawn', updated);
  return updated;
}

export type ConfirmOfferResult = {
  request: Prisma.ServiceRequestGetPayload<{ select: typeof requestSelect }>;
  offer: RequestOfferDto;
  workerAccess: WorkerAcceptanceAccess;
};

export async function confirmOffer(requestId: string, offerId: string, customerId: string): Promise<ConfirmOfferResult> {
  const result = await db.$transaction(async (tx) => {
    await lockRequestOfferSlot(tx, requestId);

    const request = await tx.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        customerId: true,
        categoryId: true,
        scheduledAt: true,
        status: true,
        workerId: true,
      },
    });
    if (!request) throw apiError(404, 'REQUEST_NOT_FOUND', 'Request not found');
    if (request.customerId !== customerId) throw apiError(403, 'NOT_YOUR_REQUEST', 'Not your request');
    if (request.status !== 'PENDING' || request.workerId) {
      throw apiError(409, 'REQUEST_ALREADY_ASSIGNED', 'This request already has a selected worker');
    }

    const offer = await tx.requestOffer.findUnique({
      where: { id: offerId },
      include: {
        worker: { select: { id: true, userId: true } },
      },
    });
    if (!offer || offer.requestId !== requestId) throw apiError(404, 'OFFER_NOT_FOUND', 'Offer not found');
    if (!ACTIVE_OFFER_STATUSES.includes(offer.status)) {
      throw apiError(409, 'OFFER_NOT_ACTIVE', 'This offer can no longer be selected');
    }

    const { access } = await assertWorkerEligibleForRequest(tx, offer.worker.userId, request);

    const assigned = await tx.serviceRequest.updateMany({
      where: { id: requestId, status: 'PENDING', workerId: null },
      data: {
        status: 'ACCEPTED',
        workerId: offer.workerId,
        priceAgreed: offer.proposedPrice,
      },
    });
    if (assigned.count !== 1) {
      throw apiError(409, 'REQUEST_ALREADY_ASSIGNED', 'This request already has a selected worker');
    }

    await tx.requestOffer.update({
      where: { id: offerId },
      data: { status: 'SELECTED' },
    });

    const notSelected = await tx.requestOffer.findMany({
      where: {
        requestId,
        id: { not: offerId },
        status: { in: ACTIVE_OFFER_STATUSES },
      },
      select: { id: true, worker: { select: { userId: true } } },
    });

    await tx.requestOffer.updateMany({
      where: {
        requestId,
        id: { not: offerId },
        status: { in: ACTIVE_OFFER_STATUSES },
      },
      data: { status: 'NOT_SELECTED' },
    });

    if (access.freeRequestsUsed < access.freeRequestLimit) {
      await tx.workerAcceptanceUsage.upsert({
        where: { requestId },
        update: {},
        create: { workerId: offer.workerId, requestId },
      });
    }

    const workerAccess = await getWorkerAcceptanceAccess(offer.worker.userId, tx, offer.workerId);
    const updatedRequest = await tx.serviceRequest.findUnique({
      where: { id: requestId },
      select: requestSelect,
    });
    const selectedOffer = await tx.requestOffer.findUnique({
      where: { id: offerId },
      select: offerSelect,
    });
    if (!updatedRequest || !selectedOffer) throw apiError(404, 'REQUEST_NOT_FOUND', 'Request not found');
    const [requestWithMeta] = await addOfferMetaToRequests(tx, [updatedRequest]);

    return {
      request: requestWithMeta,
      offer: selectedOffer,
      workerAccess,
      selectedWorkerUserId: offer.worker.userId,
      notSelectedUserIds: notSelected.map(item => item.worker.userId),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  dispatchNotification({
    userId: result.selectedWorkerUserId,
    type: 'OFFER_SELECTED',
    title: 'Your offer was selected',
    body: 'The customer selected your offer.',
    data: { requestId, offerId },
  }).catch(() => {});
  emitToUser(result.selectedWorkerUserId, 'request.offer.selected', { requestId, offerId });
  emitToUser(customerId, 'request.accepted', result.request);
  emitToUser(customerId, 'request.offers.closed', { requestId, selectedOfferId: offerId });
  result.notSelectedUserIds.forEach(workerUserId => {
    dispatchNotification({
      userId: workerUserId,
      type: 'OFFER_NOT_SELECTED',
      title: 'Customer selected another worker',
      body: 'The customer selected another worker for this request.',
      data: { requestId },
    }).catch(() => {});
    emitToUser(workerUserId, 'request.offer.not_selected', { requestId });
    emitToUser(workerUserId, 'request.offers.closed', { requestId, selectedOfferId: offerId });
  });

  return {
    request: result.request,
    offer: result.offer,
    workerAccess: result.workerAccess,
  };
}

export async function closeOffersForCancelledRequest(requestId: string) {
  const offers = await db.requestOffer.findMany({
    where: {
      requestId,
      status: { in: ACTIVE_OFFER_STATUSES },
    },
    select: { id: true, worker: { select: { userId: true } } },
  });

  await db.requestOffer.updateMany({
    where: {
      requestId,
      status: { in: ACTIVE_OFFER_STATUSES },
    },
    data: { status: 'EXPIRED' },
  });

  offers.forEach(offer => {
    dispatchNotification({
      userId: offer.worker.userId,
      type: 'REQUEST_CANCELLED',
      title: 'Request cancelled',
      body: 'The customer cancelled this request.',
      data: { requestId, offerId: offer.id },
    }).catch(() => {});
    emitToUser(offer.worker.userId, 'request.canceled', { requestId, offerId: offer.id });
    emitToUser(offer.worker.userId, 'request.offers.closed', { requestId, offerId: offer.id });
  });
}

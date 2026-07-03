import { Prisma, RequestOfferStatus, RequestStatus } from '@prisma/client';
import { db } from '../../config/database';
import { env } from '../../config/env';
import { dispatchNotification } from '../../jobs/notificationJob';
import {
  getWorkerAcceptanceAccess,
  WorkerAcceptanceAccess,
} from '../subscriptions/subscriptions.service';

export const ACTIVE_OFFER_STATUSES: RequestOfferStatus[] = ['SUBMITTED', 'DISCUSSING'];

type DbClient = Prisma.TransactionClient | typeof db;

type MatchRequest = {
  id: string;
  customerId: string;
  categoryId: string;
  title?: string;
  scheduledAt?: Date | string | null;
  category?: { name?: string | null } | null;
};

const eligibleWorkerSelect = {
  id: true,
  userId: true,
  approvedAt: true,
  isAvailable: true,
  user: { select: { id: true, role: true, isActive: true, fullName: true } },
  categories: { select: { categoryId: true } },
  availability: { select: { dayOfWeek: true, startTime: true, endTime: true } },
} satisfies Prisma.WorkerSelect;

export type EligibleWorker = Prisma.WorkerGetPayload<{ select: typeof eligibleWorkerSelect }>;

export type WorkerEligibility = {
  worker: EligibleWorker;
  access?: WorkerAcceptanceAccess;
};

export type RequestOfferMeta = {
  offerCount: number;
  maxOffers: number;
  offersOpen: boolean;
};

function apiError(status: number, code: string, message: string, details?: unknown) {
  return { status, code, message, ...(details !== undefined && { details }) };
}

export function workerMatchesSchedule(worker: Pick<EligibleWorker, 'availability'>, scheduledAt?: Date | string | null) {
  if (!scheduledAt || worker.availability.length === 0) return true;
  const scheduled = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return true;
  return worker.availability.some(slot => slot.dayOfWeek === scheduled.getDay());
}

function assertBasicWorkerEligibility(worker: EligibleWorker | null, request: MatchRequest) {
  if (!worker) throw apiError(404, 'WORKER_PROFILE_NOT_FOUND', 'Worker profile not found');
  if (worker.userId === request.customerId) {
    throw apiError(403, 'WORKER_NOT_ELIGIBLE', 'Worker cannot offer on their own request');
  }
  if (worker.user.role !== 'WORKER' || !worker.user.isActive) {
    throw apiError(403, 'WORKER_NOT_ELIGIBLE', 'Worker account is not eligible');
  }
  if (!worker.approvedAt) throw apiError(403, 'WORKER_NOT_APPROVED', 'Worker not yet approved');
  if (!worker.isAvailable) throw apiError(403, 'WORKER_UNAVAILABLE', 'Worker is not available for new offers');
  if (!worker.categories.some(item => item.categoryId === request.categoryId)) {
    throw apiError(403, 'WORKER_CATEGORY_MISMATCH', 'Worker does not match this service category');
  }
  if (!workerMatchesSchedule(worker, request.scheduledAt)) {
    throw apiError(403, 'WORKER_UNAVAILABLE', 'Worker is not available for the requested time');
  }
}

export function assertWorkerCanSubmitOffer(access: WorkerAcceptanceAccess) {
  if (!access.canAcceptMoreRequests) {
    throw apiError(
      402,
      'WORKER_SUBSCRIPTION_REQUIRED',
      'An active Worker Pro subscription is required to submit more offers.',
      access,
    );
  }
}

export async function assertWorkerEligibleForRequest(
  client: DbClient,
  userId: string,
  request: MatchRequest,
): Promise<WorkerEligibility> {
  const worker = await client.worker.findUnique({
    where: { userId },
    select: eligibleWorkerSelect,
  });

  assertBasicWorkerEligibility(worker, request);

  const access = await getWorkerAcceptanceAccess(userId, client, worker!.id);
  assertWorkerCanSubmitOffer(access);

  return { worker: worker!, access };
}

export async function findEligibleWorkersForRequest(
  client: DbClient,
  request: MatchRequest,
): Promise<WorkerEligibility[]> {
  const workers = await client.worker.findMany({
    where: {
      approvedAt: { not: null },
      isAvailable: true,
      userId: { not: request.customerId },
      user: { role: 'WORKER', isActive: true },
      categories: { some: { categoryId: request.categoryId } },
    },
    select: eligibleWorkerSelect,
  });

  const eligible: WorkerEligibility[] = [];
  for (const worker of workers) {
    if (!workerMatchesSchedule(worker, request.scheduledAt)) continue;
    eligible.push({ worker });
  }

  return eligible;
}

export function buildIncomingRequestWhereFromWorker(
  worker: EligibleWorker | null,
  userId: string,
): Prisma.ServiceRequestWhereInput | null {
  if (!worker) return null;
  if (worker.user.role !== 'WORKER' || !worker.user.isActive || !worker.approvedAt || !worker.isAvailable) return null;
  const categoryIds = worker.categories.map(item => item.categoryId);
  if (categoryIds.length === 0) return null;

  return {
    status: 'PENDING',
    workerId: null,
    customerId: { not: userId },
    categoryId: { in: categoryIds },
  };
}

export async function buildIncomingRequestWhereForWorker(
  client: DbClient,
  userId: string,
): Promise<Prisma.ServiceRequestWhereInput | null> {
  const worker = await client.worker.findUnique({
    where: { userId },
    select: eligibleWorkerSelect,
  });

  return buildIncomingRequestWhereFromWorker(worker, userId);
}

export async function getRequestOfferMeta(
  client: DbClient,
  requestId: string,
  status: RequestStatus,
  assignedWorker?: unknown,
): Promise<RequestOfferMeta> {
  const offerCount = await client.requestOffer.count({
    where: { requestId, status: { in: ACTIVE_OFFER_STATUSES } },
  });
  const offersOpen = status === 'PENDING' && !assignedWorker && offerCount < env.MAX_OFFERS_PER_REQUEST;
  return { offerCount, maxOffers: env.MAX_OFFERS_PER_REQUEST, offersOpen };
}

export async function addOfferMetaToRequests<T extends { id: string; status: RequestStatus; worker?: unknown | null }>(
  client: DbClient,
  requests: T[],
): Promise<(T & RequestOfferMeta)[]> {
  if (requests.length === 0) return [];

  const grouped = await client.requestOffer.groupBy({
    by: ['requestId'],
    where: {
      requestId: { in: requests.map(item => item.id) },
      status: { in: ACTIVE_OFFER_STATUSES },
    },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map(item => [item.requestId, item._count._all]));

  return requests.map(request => {
    const offerCount = counts.get(request.id) ?? 0;
    return {
      ...request,
      offerCount,
      maxOffers: env.MAX_OFFERS_PER_REQUEST,
      offersOpen: request.status === 'PENDING' && !request.worker && offerCount < env.MAX_OFFERS_PER_REQUEST,
    };
  });
}

export async function notifyEligibleWorkersForRequest(request: MatchRequest) {
  const meta = await getRequestOfferMeta(db, request.id, 'PENDING', null);
  if (!meta.offersOpen) return;

  const eligibleWorkers = await findEligibleWorkersForRequest(db, request);
  const categoryName = request.category?.name ?? 'service';
  await Promise.allSettled(
    eligibleWorkers.map(({ worker }) =>
      dispatchNotification({
        userId: worker.userId,
        type: 'NEW_MATCHING_REQUEST',
        title: `New ${categoryName} request near you`,
        body: `A customer needs help with ${categoryName}.`,
        data: { requestId: request.id },
      }),
    ),
  );
}

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
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  serviceCity?: string | null;
  scheduledAt?: Date | string | null;
  category?: { name?: string | null } | null;
};

const eligibleWorkerSelect = {
  id: true,
  userId: true,
  bio: true,
  yearsExp: true,
  hourlyRate: true,
  primaryServiceCity: true,
  additionalServiceCities: true,
  serviceRadiusKm: true,
  baseLatitude: true,
  baseLongitude: true,
  approvedAt: true,
  isAvailable: true,
  user: { select: { id: true, role: true, isActive: true, fullName: true, phone: true, avatarUrl: true } },
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

function normalizeCity(value?: string | null) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cityFromAddress(address?: string | null) {
  const parts = (address ?? '').split(',').map(part => part.trim()).filter(Boolean);
  return parts.length > 1 ? normalizeCity(parts[parts.length - 1]) : '';
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

function hasWorkerRadius(worker: Pick<EligibleWorker, 'baseLatitude' | 'baseLongitude' | 'serviceRadiusKm'>) {
  return worker.baseLatitude != null && worker.baseLongitude != null && worker.serviceRadiusKm != null;
}

function hasWorkerCityArea(worker: Pick<EligibleWorker, 'primaryServiceCity' | 'additionalServiceCities'>) {
  return Boolean(normalizeCity(worker.primaryServiceCity)) || worker.additionalServiceCities.length > 0;
}

export function workerMatchesServiceArea(
  worker: Pick<EligibleWorker, 'primaryServiceCity' | 'additionalServiceCities' | 'serviceRadiusKm' | 'baseLatitude' | 'baseLongitude'>,
  request: Pick<MatchRequest, 'lat' | 'lng' | 'address' | 'serviceCity'>,
) {
  const hasRequestCoordinates = request.lat != null && request.lng != null && !(request.lat === 0 && request.lng === 0);
  const requestCity = normalizeCity(request.serviceCity) || cityFromAddress(request.address);

  if (!hasRequestCoordinates && !requestCity) return true;

  if (hasRequestCoordinates && hasWorkerRadius(worker)) {
    return distanceKm(
      { lat: request.lat!, lng: request.lng! },
      { lat: worker.baseLatitude!, lng: worker.baseLongitude! },
    ) <= worker.serviceRadiusKm!;
  }

  if (requestCity) {
    const workerCities = [
      normalizeCity(worker.primaryServiceCity),
      ...worker.additionalServiceCities.map(normalizeCity),
    ].filter(Boolean);
    if (workerCities.length > 0) return workerCities.includes(requestCity);
  }

  // TODO before public launch: make service-area configuration mandatory for
  // located requests. This keeps existing development workers visible for now.
  return !hasWorkerRadius(worker) && !hasWorkerCityArea(worker);
}

const PHONE_REGEX = /^(\+?[1-9]\d{7,14}|0\d{8,14})$/;

export function isWorkerProfileCompleteForMatching(worker: EligibleWorker) {
  const fullName = worker.user.fullName?.trim() ?? '';
  const phone = worker.user.phone?.trim() ?? '';
  const bio = worker.bio?.trim() ?? '';
  const hourlyRate = Number(worker.hourlyRate ?? 0);

  return (
    fullName.length >= 2 &&
    PHONE_REGEX.test(phone) &&
    Boolean(worker.user.avatarUrl) &&
    bio.length >= 20 &&
    Number.isFinite(worker.yearsExp) &&
    worker.yearsExp >= 0 &&
    Number.isFinite(hourlyRate) &&
    hourlyRate > 0 &&
    worker.categories.length > 0 &&
    worker.availability.length > 0
  );
}

function canWorkerReceiveIncomingRequests(worker: EligibleWorker) {
  return Boolean(worker.approvedAt) || isWorkerProfileCompleteForMatching(worker);
}

function assertBasicWorkerEligibility(worker: EligibleWorker | null, request: MatchRequest) {
  if (!worker) throw apiError(404, 'WORKER_PROFILE_NOT_FOUND', 'Worker profile not found');
  if (worker.userId === request.customerId) {
    throw apiError(403, 'WORKER_NOT_ELIGIBLE', 'Worker cannot offer on their own request');
  }
  if (worker.user.role !== 'WORKER' || !worker.user.isActive) {
    throw apiError(403, 'WORKER_NOT_ELIGIBLE', 'Worker account is not eligible');
  }
  if (!canWorkerReceiveIncomingRequests(worker)) {
    throw apiError(403, 'WORKER_PROFILE_INCOMPLETE', 'Worker profile must be completed before receiving requests');
  }
  if (!worker.isAvailable) throw apiError(403, 'WORKER_UNAVAILABLE', 'Worker is not available for new offers');
  if (!worker.categories.some(item => item.categoryId === request.categoryId)) {
    throw apiError(403, 'WORKER_CATEGORY_MISMATCH', 'Worker does not match this service category');
  }
  if (!workerMatchesSchedule(worker, request.scheduledAt)) {
    throw apiError(403, 'WORKER_UNAVAILABLE', 'Worker is not available for the requested time');
  }
  if (!workerMatchesServiceArea(worker, request)) {
    throw apiError(403, 'WORKER_OUTSIDE_SERVICE_AREA', 'Worker does not serve this request location');
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
      isAvailable: true,
      userId: { not: request.customerId },
      user: { role: 'WORKER', isActive: true },
      categories: { some: { categoryId: request.categoryId } },
    },
    select: eligibleWorkerSelect,
  });

  const eligible: WorkerEligibility[] = [];
  for (const worker of workers) {
    if (!canWorkerReceiveIncomingRequests(worker)) continue;
    if (!workerMatchesSchedule(worker, request.scheduledAt)) continue;
    if (!workerMatchesServiceArea(worker, request)) continue;
    eligible.push({ worker });
  }

  return eligible;
}

export function buildIncomingRequestWhereFromWorker(
  worker: EligibleWorker | null,
  userId: string,
): Prisma.ServiceRequestWhereInput | null {
  if (!worker) return null;
  if (
    worker.user.role !== 'WORKER'
    || !worker.user.isActive
    || !worker.isAvailable
    || !canWorkerReceiveIncomingRequests(worker)
  ) return null;
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

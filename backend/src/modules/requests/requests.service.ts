import { RequestStatus, Prisma } from '@prisma/client';
import { db } from '../../config/database';
import { uploadBuffer } from '../../config/cloudinary';
import { pushToUser } from '../../utils/fcm';

// ─── FSM ─────────────────────────────────────────────────────────────────────
type Actor = 'CUSTOMER' | 'WORKER';

const TRANSITIONS: Record<
  RequestStatus,
  { next: RequestStatus; by: Actor }[]
> = {
  PENDING:     [{ next: 'ACCEPTED',    by: 'WORKER'   }, { next: 'CANCELLED', by: 'CUSTOMER' }],
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

// ─── Shared select ────────────────────────────────────────────────────────────
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
      user: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
    },
  },
} satisfies Prisma.ServiceRequestSelect;

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createRequest(
  customerId: string,
  body: {
    categoryId: string;
    title: string;
    description: string;
    lat: number;
    lng: number;
    address: string;
    scheduledAt?: string;
    paymentMethod: 'ONLINE' | 'CASH';
  },
  files: Express.Multer.File[],
) {
  const category = await db.serviceCategory.findUnique({
    where: { id: body.categoryId, isActive: true },
  });
  if (!category) throw { status: 404, message: 'Service category not found' };

  const imageUrls =
    files.length > 0
      ? await Promise.all(files.map((f) => uploadBuffer(f.buffer, 'worker/requests')))
      : [];

  const request = await db.serviceRequest.create({
    data: {
      customerId,
      categoryId: body.categoryId,
      title: body.title,
      description: body.description,
      lat: body.lat,
      lng: body.lng,
      address: body.address,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      paymentMethod: body.paymentMethod,
      images: {
        create: imageUrls.map((url, order) => ({ imageUrl: url, order })),
      },
    },
    select: requestSelect,
  });

  return request;
}

// ─── List ─────────────────────────────────────────────────────────────────────
export async function listRequests(
  userId: string,
  role: Actor,
  query: { status?: RequestStatus; page: number; limit: number },
) {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ServiceRequestWhereInput =
    role === 'CUSTOMER'
      ? { customerId: userId, ...(status && { status }) }
      : status === 'PENDING'
      ? { status: 'PENDING' }
      : status
      ? { worker: { userId }, status }
      : {
          OR: [
            { status: 'PENDING' },
            { worker: { userId } },
          ],
        };

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

  return {
    items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
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

  return request;
}

// ─── Update status ────────────────────────────────────────────────────────────
export async function updateStatus(
  id: string,
  userId: string,
  role: Actor,
  newStatus: RequestStatus,
  cancellationReason?: string,
) {
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
    const isPendingAccept = request.status === 'PENDING' && newStatus === 'ACCEPTED';
    const isAssigned = request.worker?.userId === userId;
    if (!isPendingAccept && !isAssigned) {
      throw { status: 403, message: 'You are not assigned to this request' };
    }
  }

  assertTransition(request.status, newStatus, role);

  // When a worker accepts, link their worker record
  let workerId: string | undefined;
  if (role === 'WORKER' && newStatus === 'ACCEPTED') {
    const worker = await db.worker.findUnique({ where: { userId } });
    if (!worker) throw { status: 404, message: 'Worker profile not found' };
    if (!worker.approvedAt) throw { status: 403, message: 'Worker not yet approved' };
    workerId = worker.id;
  }

  const updated = await db.serviceRequest.update({
    where: { id },
    data: {
      status: newStatus,
      ...(workerId && { workerId }),
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

  // Fire-and-forget push notifications
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

  return updated;
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

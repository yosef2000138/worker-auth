import { Prisma } from '@prisma/client';
import { requestReviewSelect } from '../reviews/reviews.service';

export const requestSelect = {
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

const PUBLIC_PENDING_ADDRESS = 'Approximate service area';

function publicAreaFromAddress(address?: string | null) {
  if (!address) return undefined;
  const parts = address
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts[parts.length - 1];
  return PUBLIC_PENDING_ADDRESS;
}

export type RequestViewer = {
  userId: string;
  role: string;
  workerId?: string | null;
};

export type RequestResponseShape = Prisma.ServiceRequestGetPayload<{ select: typeof requestSelect }> & {
  offerCount?: number;
  maxOffers?: number;
  offersOpen?: boolean;
  hasMyOffer?: boolean;
  myOfferId?: string | null;
  myOfferStatus?: string | null;
  canReview?: boolean;
};

export function canViewPrivateRequestData(request: RequestResponseShape, viewer: RequestViewer) {
  if (viewer.role === 'ADMIN') return true;
  if (viewer.role === 'CUSTOMER') return request.customer?.id === viewer.userId;
  if (viewer.role === 'WORKER') {
    return Boolean(
      request.worker
      && (
        request.worker.id === viewer.workerId
        || request.worker.user?.id === viewer.userId
      ),
    );
  }
  return false;
}

export function serializeRequestForViewer<T extends RequestResponseShape>(
  request: T,
  viewer: RequestViewer,
): T {
  if (canViewPrivateRequestData(request, viewer)) return request;

  return {
    ...request,
    address: publicAreaFromAddress(request.address),
    lat: undefined,
    lng: undefined,
    customer: undefined,
  } as T;
}

export function serializeRequestsForViewer<T extends RequestResponseShape>(
  requests: T[],
  viewer: RequestViewer,
) {
  return requests.map(item => serializeRequestForViewer(item, viewer));
}

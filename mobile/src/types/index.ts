export type Role = 'CUSTOMER' | 'WORKER' | 'ADMIN';
export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'ON_THE_WAY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RequestOfferStatus = 'SUBMITTED' | 'DISCUSSING' | 'SELECTED' | 'NOT_SELECTED' | 'WITHDRAWN' | 'EXPIRED';
export type PaymentMethod = 'ONLINE' | 'CASH';

export type ApiEnvelope<T> = { success: boolean; data: T; message?: string };

export type Pagination = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type Paginated<T> = {
  items?: T[];
  data?: T[];
  pagination?: Pagination;
  total?: number;
  page?: number;
  limit?: number;
  pages?: number;
} | T[];

export type User = {
  id: string;
  fullName: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: Role;
  isEmailVerified?: boolean;
  isVerified?: boolean;
};

export type AuthResult = { user: User & { role: Role; email: string }; accessToken: string; refreshToken: string };
export type Category = { id: string; name: string; icon?: string | null; description?: string | null; isActive?: boolean };
export type AvailabilitySlot = { id?: string; dayOfWeek: number; startTime: string; endTime: string };

export type WorkerProfile = {
  id: string;
  userId?: string;
  user?: User;
  bio?: string | null;
  yearsExp?: number;
  hourlyRate?: number | string | null;
  fixedPrice?: number | string | null;
  workingRadius?: number;
  ratingAvg?: number;
  ratingCount?: number;
  totalReviews?: number;
  totalJobs?: number;
  isAvailable?: boolean;
  approvedAt?: string | null;
  createdAt?: string;
  availability?: AvailabilitySlot[];
  categories?: (Category | { category: Category })[];
};

export type ServiceRequest = {
  id: string;
  customerId?: string;
  workerId?: string | null;
  categoryId?: string;
  category?: Category;
  title: string;
  description: string;
  lat?: number;
  lng?: number;
  address?: string;
  scheduledAt?: string | null;
  status: RequestStatus;
  paymentMethod?: PaymentMethod;
  priceAgreed?: number | string | null;
  images?: string[] | { id: string; imageUrl: string; order?: number }[];
  createdAt?: string;
  updatedAt?: string;
  worker?: WorkerProfile | null;
  customer?: User;
  review?: Review | null;
  canReview?: boolean;
  offerCount?: number;
  maxOffers?: number;
  offersOpen?: boolean;
  hasMyOffer?: boolean;
  myOfferId?: string | null;
  myOfferStatus?: RequestOfferStatus | null;
};

export type Message = { id: string; requestId: string; senderId: string; content: string; readAt?: string | null; createdAt: string; sender?: User };
export type RequestOffer = {
  id: string;
  requestId: string;
  workerId: string;
  proposedPrice?: number | string | null;
  message?: string | null;
  availableAt?: string | null;
  estimatedDuration?: string | null;
  status: RequestOfferStatus;
  createdAt: string;
  updatedAt?: string;
  worker?: WorkerProfile;
};
export type OfferMessage = {
  id: string;
  offerId: string;
  senderId: string;
  content: string;
  isRead?: boolean;
  createdAt: string;
  sender?: User;
};
export type RequestOffersResponse = { items: RequestOffer[]; limit: number; count: number; offersOpen?: boolean };
export type ConfirmOfferResponse = { request: ServiceRequest; offer: RequestOffer; workerAccess?: WorkerAcceptanceAccess };
export type NotificationItem = { id: string; title?: string; body?: string; message?: string; isRead?: boolean; createdAt?: string };
export type Review = {
  id: string;
  requestId?: string;
  workerId?: string;
  rating: number;
  comment?: string | null;
  createdAt?: string;
  updatedAt?: string;
  customer?: User;
  reviewer?: User;
  reviewee?: User;
  request?: Pick<ServiceRequest, 'id' | 'title' | 'category'>;
};
export type RatingDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;
export type WorkerRatingSummary = {
  averageRating: number | null;
  reviewCount: number;
  ratingDistribution: RatingDistribution;
};
export type CreateReviewResponse = {
  review: Review;
  workerRating: WorkerRatingSummary;
};
export type WorkerReviewsResponse = {
  items?: Review[];
  data?: Review[];
  pagination?: Pagination;
  total?: number;
  page?: number;
  limit?: number;
  pages?: number;
  averageRating?: number | null;
  reviewCount?: number;
  ratingDistribution?: RatingDistribution;
  ratingAvg?: number | null;
  totalReviews?: number;
};
export type Payment = { id: string; requestId: string; amount: number | string; status?: string; method?: PaymentMethod; currency?: string; createdAt?: string; request?: Pick<ServiceRequest, 'id' | 'title' | 'updatedAt'> };
export type WorkerAccessReasonCode =
  | 'FREE_REQUESTS_AVAILABLE'
  | 'WORKER_PRO_ACTIVE'
  | 'WORKER_PRO_NOT_AVAILABLE'
  | 'WORKER_SUBSCRIPTION_REQUIRED'
  | 'WORKER_PRO_REQUIRED';
export type WorkerAcceptanceAccess = {
  acceptedRequestCount: number;
  freeAcceptedRequestLimit: number;
  remainingFreeRequests: number;
  requiresSubscription: boolean;
  hasSubscriptionAccess: boolean;
  canAcceptMoreRequests: boolean;
  freeRequestsUsed?: number;
  freeRequestLimit?: number;
  freeRequestsRemaining?: number;
  subscriptionRequired?: boolean;
  hasActiveSubscription?: boolean;
  canAcceptRequest?: boolean;
  reasonCode: WorkerAccessReasonCode;
};
export type RequestStatusUpdateResult = ServiceRequest | { request: ServiceRequest; workerAccess?: WorkerAcceptanceAccess };
export type RatingEligibility = {
  requestId: string;
  completed: boolean;
  hasWorker: boolean;
  alreadyRated: boolean;
  canRate: boolean;
  request?: Pick<ServiceRequest, 'id' | 'title' | 'category'> & { completedAt?: string | null };
  worker?: WorkerProfile | null;
  review?: Review | null;
};

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  CustomerApp: undefined;
  WorkerApp: undefined;
  Messages: undefined;
  Map: {
    lat?: number | null;
    lng?: number | null;
    address?: string | null;
    title?: string;
    requestId?: string;
  } | undefined;
  CustomerHomeTab: undefined;
  CustomerHome: undefined;
  Categories: undefined;
  CreateRequest: { categoryId?: string } | undefined;
  WorkerProfile: { workerId: string };
  RequestDetails: { requestId: string };
  Rating: { requestId: string };
  Chat: { requestId: string };
  OfferChat: { requestId: string; offerId: string };
  Notifications: undefined;
  Profile: undefined;
  WorkerOnboarding: undefined;
  WorkerJobs: undefined;
  WorkerDashboard: undefined;
  IncomingRequests: undefined;
  ActiveJob: { requestId?: string } | undefined;
  Reviews: undefined;
  Availability: undefined;
  WorkerOwnProfile: undefined;
  Subscription: undefined;
};

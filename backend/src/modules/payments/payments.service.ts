import { db } from '../../config/database';
import { CreatePaymentIntentInput, ConfirmPaymentInput } from './payments.schema';

// ─── Shared payment select ────────────────────────────────────────────────────
const paymentSelect = {
  id: true,
  amount: true,
  currency: true,
  method: true,
  status: true,
  stripePaymentIntent: true,
  createdAt: true,
  request: {
    select: {
      id: true,
      title: true,
      status: true,
      customer: { select: { id: true, fullName: true } },
      worker: { select: { user: { select: { id: true, fullName: true } } } },
    },
  },
};

// ─── Create payment intent (Stripe stub) ─────────────────────────────────────
export async function createPaymentIntent(
  customerId: string,
  input: CreatePaymentIntentInput,
) {
  const request = await db.serviceRequest.findUnique({
    where: { id: input.requestId },
    include: { payment: true },
  });

  if (!request) throw { status: 404, message: 'Request not found' };
  if (request.customerId !== customerId) {
    throw { status: 403, message: 'Not your request' };
  }
  if (request.paymentMethod !== 'ONLINE') {
    throw { status: 422, message: 'Request uses cash payment' };
  }
  if (request.payment) {
    throw { status: 409, message: 'Payment already exists for this request' };
  }

  const amount = Number(request.priceAgreed ?? 0);
  if (amount <= 0) {
    throw { status: 422, message: 'No agreed price set. Update the request first.' };
  }

  // --- Stripe stub ---
  // In production: const intent = await stripe.paymentIntents.create({ amount: amount * 100, currency: 'usd' });
  const stripePaymentIntent = `pi_stub_${Date.now()}`;

  const payment = await db.payment.create({
    data: {
      requestId: input.requestId,
      amount,
      currency: 'usd',
      method: 'ONLINE',
      status: 'PENDING',
      stripePaymentIntent,
    },
    select: paymentSelect,
  });

  return { payment, clientSecret: `${stripePaymentIntent}_secret_stub` };
}

// ─── Confirm payment (called by Stripe webhook or manually for testing) ───────
export async function confirmPayment(input: ConfirmPaymentInput) {
  const payment = await db.payment.findUnique({
    where: { requestId: input.requestId },
  });
  if (!payment) throw { status: 404, message: 'Payment not found' };
  if (payment.status === 'COMPLETED') {
    throw { status: 409, message: 'Payment already completed' };
  }

  const updated = await db.payment.update({
    where: { requestId: input.requestId },
    data: { status: 'COMPLETED', amount: input.amount },
    select: paymentSelect,
  });

  return updated;
}

// ─── Record cash payment ──────────────────────────────────────────────────────
export async function recordCashPayment(
  workerId_userId: string,
  requestId: string,
  amount: number,
) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
    include: { worker: true, payment: true },
  });

  if (!request) throw { status: 404, message: 'Request not found' };
  if (request.worker?.userId !== workerId_userId) {
    throw { status: 403, message: 'Only the assigned worker can record cash payment' };
  }
  if (request.paymentMethod !== 'CASH') {
    throw { status: 422, message: 'Request uses online payment' };
  }
  if (request.payment) {
    throw { status: 409, message: 'Payment already recorded' };
  }
  if (request.status !== 'COMPLETED') {
    throw { status: 422, message: 'Request must be completed first' };
  }

  const payment = await db.payment.create({
    data: {
      requestId,
      amount,
      currency: 'usd',
      method: 'CASH',
      status: 'COMPLETED',
    },
    select: paymentSelect,
  });

  return payment;
}

// ─── Get payment by request ID ────────────────────────────────────────────────
export async function getPaymentByRequest(requestId: string, userId: string) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
    include: { worker: true, payment: { select: paymentSelect } },
  });

  if (!request) throw { status: 404, message: 'Request not found' };

  const isCustomer = request.customerId === userId;
  const isWorker = request.worker?.userId === userId;
  if (!isCustomer && !isWorker) {
    throw { status: 403, message: 'Not a participant in this request' };
  }

  if (!request.payment) throw { status: 404, message: 'No payment found for this request' };

  return request.payment;
}

// ─── Payment history for authenticated user ───────────────────────────────────
export async function getPaymentHistory(
  userId: string,
  role: string,
  page: number,
  limit: number,
) {
  const skip = (page - 1) * limit;

  const where =
    role === 'CUSTOMER'
      ? { request: { customerId: userId } }
      : { request: { worker: { userId } } };

  const [total, items] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      select: paymentSelect,
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

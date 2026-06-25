import { db } from '../../config/database';
import { comparePassword, hashPassword } from '../../utils/bcrypt';
import { UpdateProfileInput, ChangePasswordInput } from './users.schema';

// ─── Safe user shape (no password hash) ─────────────────────────────────────
function safeUser(user: {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

// ─── Get own profile ─────────────────────────────────────────────────────────
export async function getProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      avatarUrl: true,
      isVerified: true,
      isActive: true,
      createdAt: true,
      worker: {
        select: {
          id: true,
          bio: true,
          yearsExp: true,
          hourlyRate: true,
          fixedPrice: true,
          isAvailable: true,
          ratingAvg: true,
          totalReviews: true,
          totalJobs: true,
          workingRadius: true,
          approvedAt: true,
          categories: {
            select: { category: { select: { id: true, name: true, icon: true } } },
          },
        },
      },
    },
  });

  if (!user) throw { status: 404, message: 'User not found' };
  return user;
}

// ─── Update profile ──────────────────────────────────────────────────────────
export async function updateProfile(userId: string, input: UpdateProfileInput) {
  // Phone uniqueness check
  if (input.phone) {
    const existing = await db.user.findFirst({
      where: { phone: input.phone, NOT: { id: userId } },
    });
    if (existing) throw { status: 409, message: 'Phone number already in use' };
  }

  const user = await db.user.update({
    where: { id: userId },
    data: {
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      avatarUrl: true,
      isVerified: true,
      isActive: true,
      createdAt: true,
    },
  });

  return safeUser(user);
}

// ─── Change password ─────────────────────────────────────────────────────────
export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw { status: 404, message: 'User not found' };

  const valid = await comparePassword(input.currentPassword, user.passwordHash);
  if (!valid) throw { status: 401, message: 'Current password is incorrect' };

  const passwordHash = await hashPassword(input.newPassword);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });

  return { message: 'Password changed successfully' };
}

// ─── Favorites ───────────────────────────────────────────────────────────────
export async function getFavorites(customerId: string) {
  const favorites = await db.favorite.findMany({
    where: { customerId },
    select: {
      id: true,
      worker: {
        select: {
          id: true,
          ratingAvg: true,
          totalReviews: true,
          totalJobs: true,
          isAvailable: true,
          hourlyRate: true,
          fixedPrice: true,
          user: { select: { id: true, fullName: true, avatarUrl: true } },
          categories: {
            select: { category: { select: { id: true, name: true, icon: true } } },
          },
        },
      },
    },
    orderBy: { id: 'desc' },
  });

  return favorites.map((f) => ({ favoriteId: f.id, ...f.worker }));
}

export async function addFavorite(customerId: string, workerId: string) {
  const worker = await db.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw { status: 404, message: 'Worker not found' };

  const existing = await db.favorite.findUnique({
    where: { customerId_workerId: { customerId, workerId } },
  });
  if (existing) throw { status: 409, message: 'Already in favorites' };

  const fav = await db.favorite.create({
    data: { customerId, workerId },
    select: { id: true, workerId: true, customerId: true },
  });

  return fav;
}

export async function removeFavorite(customerId: string, workerId: string) {
  const existing = await db.favorite.findUnique({
    where: { customerId_workerId: { customerId, workerId } },
  });
  if (!existing) throw { status: 404, message: 'Favorite not found' };

  await db.favorite.delete({
    where: { customerId_workerId: { customerId, workerId } },
  });

  return { message: 'Removed from favorites' };
}

// ─── Request history ─────────────────────────────────────────────────────────
export async function getRequestHistory(
  userId: string,
  role: string,
  page: number,
  limit: number,
) {
  const skip = (page - 1) * limit;
  const where =
    role === 'CUSTOMER'
      ? { customerId: userId }
      : { worker: { userId } };

  const [total, items] = await Promise.all([
    db.serviceRequest.count({ where }),
    db.serviceRequest.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        paymentMethod: true,
        priceAgreed: true,
        createdAt: true,
        category: { select: { id: true, name: true, icon: true } },
        customer: { select: { id: true, fullName: true, avatarUrl: true } },
        worker: {
          select: {
            id: true,
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
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

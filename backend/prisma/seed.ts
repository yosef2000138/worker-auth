import 'dotenv/config';
import { PaymentMethod, PaymentStatus, PrismaClient, RequestStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const DEMO_PASSWORD = 'Test12345';

const categorySeeds = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Plumbing',
    aliases: ['Plumber'],
    icon: 'water-outline',
    description: 'Leaks, faucets, drains, toilets, and pipe repairs.',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Electrical',
    aliases: ['Electrician'],
    icon: 'flash-outline',
    description: 'Lighting, outlets, breakers, wiring checks, and small electrical repairs.',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Cleaning',
    aliases: [],
    icon: 'sparkles-outline',
    description: 'Home cleaning, deep cleaning, and move-in or move-out cleaning.',
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    name: 'Painting',
    aliases: ['Painter'],
    icon: 'color-palette-outline',
    description: 'Interior painting, wall touch-ups, patching, and finishing.',
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    name: 'Carpentry',
    aliases: ['Carpenter'],
    icon: 'hammer-outline',
    description: 'Shelves, doors, cabinets, furniture fixes, and wood repairs.',
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    name: 'Air Conditioning',
    aliases: ['AC Repair'],
    icon: 'snow-outline',
    description: 'Air conditioner cleaning, diagnostics, repair, and seasonal service.',
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    name: 'Moving',
    aliases: ['Furniture Moving'],
    icon: 'cube-outline',
    description: 'Small moves, furniture lifting, packing help, and assembly support.',
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    name: 'Gardening',
    aliases: [],
    icon: 'leaf-outline',
    description: 'Garden cleanup, planting, trimming, lawn care, and irrigation checks.',
  },
  {
    id: '10000000-0000-4000-8000-000000000009',
    name: 'Appliance Repair',
    aliases: ['Appliances'],
    icon: 'hardware-chip-outline',
    description: 'Washing machines, ovens, refrigerators, and dishwasher troubleshooting.',
  },
  {
    id: '10000000-0000-4000-8000-000000000010',
    name: 'Home Maintenance',
    aliases: [],
    icon: 'construct-outline',
    description: 'General handyman work, small repairs, installations, and inspections.',
  },
] as const;

type CategoryName = (typeof categorySeeds)[number]['name'];

const userSeeds = [
  {
    email: 'customer@test.com',
    fullName: 'Test Customer',
    phone: '+972501111111',
    role: UserRole.CUSTOMER,
    avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    email: 'worker@test.com',
    fullName: 'Daniel Cohen',
    phone: '+972502222222',
    role: UserRole.WORKER,
    avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    email: 'maya.cleaning@test.com',
    fullName: 'Maya Levi',
    phone: '+972503333333',
    role: UserRole.WORKER,
    avatarUrl: 'https://randomuser.me/api/portraits/women/65.jpg',
  },
  {
    email: 'amir.plumbing@test.com',
    fullName: 'Amir Haddad',
    phone: '+972504444444',
    role: UserRole.WORKER,
    avatarUrl: 'https://randomuser.me/api/portraits/men/76.jpg',
  },
  {
    email: 'sara.electrical@test.com',
    fullName: 'Sara Mansour',
    phone: '+972505555555',
    role: UserRole.WORKER,
    avatarUrl: 'https://randomuser.me/api/portraits/women/12.jpg',
  },
  {
    email: 'noam.ac@test.com',
    fullName: 'Noam Bar',
    phone: '+972506666666',
    role: UserRole.WORKER,
    avatarUrl: 'https://randomuser.me/api/portraits/men/18.jpg',
  },
  {
    email: 'lina.garden@test.com',
    fullName: 'Lina Farah',
    phone: '+972507777777',
    role: UserRole.WORKER,
    avatarUrl: 'https://randomuser.me/api/portraits/women/28.jpg',
  },
] as const;

const workerSeeds = [
  {
    email: 'worker@test.com',
    bio: 'Licensed handyman focused on electrical repairs, lighting, shelves, and everyday home maintenance.',
    yearsExp: 7,
    hourlyRate: '180.00',
    fixedPrice: '250.00',
    ratingAvg: 4.9,
    totalReviews: 48,
    totalJobs: 126,
    workingRadius: 25,
    categories: ['Electrical', 'Home Maintenance', 'Carpentry'] satisfies CategoryName[],
  },
  {
    email: 'maya.cleaning@test.com',
    bio: 'Reliable cleaner for apartments, offices, move-in cleaning, and deep seasonal cleaning.',
    yearsExp: 5,
    hourlyRate: '120.00',
    fixedPrice: '350.00',
    ratingAvg: 4.8,
    totalReviews: 39,
    totalJobs: 101,
    workingRadius: 18,
    categories: ['Cleaning', 'Home Maintenance'] satisfies CategoryName[],
  },
  {
    email: 'amir.plumbing@test.com',
    bio: 'Plumber specializing in leaks, blocked drains, faucet replacement, and kitchen sink repairs.',
    yearsExp: 9,
    hourlyRate: '210.00',
    fixedPrice: '300.00',
    ratingAvg: 4.7,
    totalReviews: 55,
    totalJobs: 144,
    workingRadius: 30,
    categories: ['Plumbing', 'Appliance Repair'] satisfies CategoryName[],
  },
  {
    email: 'sara.electrical@test.com',
    bio: 'Certified electrician for safe outlet repairs, light fixtures, breaker checks, and troubleshooting.',
    yearsExp: 6,
    hourlyRate: '220.00',
    fixedPrice: '280.00',
    ratingAvg: 4.95,
    totalReviews: 62,
    totalJobs: 158,
    workingRadius: 22,
    categories: ['Electrical', 'Home Maintenance'] satisfies CategoryName[],
  },
  {
    email: 'noam.ac@test.com',
    bio: 'Air conditioning technician for cleaning, diagnostics, coolant checks, and fast summer repairs.',
    yearsExp: 8,
    hourlyRate: '240.00',
    fixedPrice: '400.00',
    ratingAvg: 4.6,
    totalReviews: 44,
    totalJobs: 117,
    workingRadius: 35,
    categories: ['Air Conditioning', 'Appliance Repair'] satisfies CategoryName[],
  },
  {
    email: 'lina.garden@test.com',
    bio: 'Gardening and outdoor maintenance, including trimming, planting, balcony gardens, and irrigation checks.',
    yearsExp: 4,
    hourlyRate: '140.00',
    fixedPrice: '320.00',
    ratingAvg: 4.85,
    totalReviews: 31,
    totalJobs: 79,
    workingRadius: 20,
    categories: ['Gardening', 'Home Maintenance'] satisfies CategoryName[],
  },
] as const;

const requestSeeds = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    customerEmail: 'customer@test.com',
    workerEmail: null,
    category: 'Plumbing' satisfies CategoryName,
    title: 'Kitchen sink leak',
    description: 'Water is dripping under the kitchen sink and the cabinet is getting wet.',
    status: RequestStatus.PENDING,
    lat: 32.0853,
    lng: 34.7818,
    address: 'Dizengoff St 100, Tel Aviv',
    scheduledAt: '2026-06-28T08:00:00.000Z',
    priceAgreed: null,
    paymentMethod: PaymentMethod.CASH,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    customerEmail: 'customer@test.com',
    workerEmail: 'worker@test.com',
    category: 'Electrical' satisfies CategoryName,
    title: 'Install two ceiling lights',
    description: 'Need help installing two new ceiling lights in the living room.',
    status: RequestStatus.ACCEPTED,
    lat: 32.0809,
    lng: 34.7806,
    address: 'King George St 40, Tel Aviv',
    scheduledAt: '2026-06-29T10:30:00.000Z',
    priceAgreed: '320.00',
    paymentMethod: PaymentMethod.CASH,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    customerEmail: 'customer@test.com',
    workerEmail: 'maya.cleaning@test.com',
    category: 'Cleaning' satisfies CategoryName,
    title: 'Deep clean after renovation',
    description: 'Apartment needs deep cleaning after small renovation work.',
    status: RequestStatus.IN_PROGRESS,
    lat: 32.074,
    lng: 34.792,
    address: 'Rothschild Blvd 12, Tel Aviv',
    scheduledAt: '2026-06-27T07:00:00.000Z',
    priceAgreed: '450.00',
    paymentMethod: PaymentMethod.ONLINE,
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    customerEmail: 'customer@test.com',
    workerEmail: 'amir.plumbing@test.com',
    category: 'Plumbing' satisfies CategoryName,
    title: 'Replace bathroom faucet',
    description: 'Old bathroom faucet was replaced with a new one.',
    status: RequestStatus.COMPLETED,
    lat: 32.069,
    lng: 34.777,
    address: 'Allenby St 85, Tel Aviv',
    scheduledAt: '2026-06-20T11:00:00.000Z',
    priceAgreed: '260.00',
    paymentMethod: PaymentMethod.CASH,
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    customerEmail: 'customer@test.com',
    workerEmail: 'sara.electrical@test.com',
    category: 'Electrical' satisfies CategoryName,
    title: 'Fix bedroom outlet',
    description: 'The bedroom outlet was loose and stopped working.',
    status: RequestStatus.COMPLETED,
    lat: 32.091,
    lng: 34.789,
    address: 'Ibn Gabirol St 72, Tel Aviv',
    scheduledAt: '2026-06-18T14:00:00.000Z',
    priceAgreed: '220.00',
    paymentMethod: PaymentMethod.ONLINE,
  },
  {
    id: '30000000-0000-4000-8000-000000000006',
    customerEmail: 'customer@test.com',
    workerEmail: 'noam.ac@test.com',
    category: 'Air Conditioning' satisfies CategoryName,
    title: 'AC cleaning and filter check',
    description: 'Bedroom AC smells dusty and needs cleaning before summer.',
    status: RequestStatus.CANCELLED,
    lat: 32.064,
    lng: 34.771,
    address: 'Florentin St 18, Tel Aviv',
    scheduledAt: '2026-06-22T15:30:00.000Z',
    priceAgreed: null,
    paymentMethod: PaymentMethod.CASH,
  },
] as const;

const reviewSeeds = [
  {
    requestId: '30000000-0000-4000-8000-000000000004',
    reviewerEmail: 'customer@test.com',
    revieweeEmail: 'amir.plumbing@test.com',
    rating: 5,
    comment: 'Arrived on time, explained the problem, and left everything clean.',
  },
  {
    requestId: '30000000-0000-4000-8000-000000000005',
    reviewerEmail: 'customer@test.com',
    revieweeEmail: 'sara.electrical@test.com',
    rating: 5,
    comment: 'Very professional and careful. The outlet works perfectly now.',
  },
] as const;

const messageSeeds = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    requestId: '30000000-0000-4000-8000-000000000002',
    senderEmail: 'customer@test.com',
    content: 'Hi Daniel, can you come in the morning?',
    isRead: true,
    createdAt: '2026-06-26T07:30:00.000Z',
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    requestId: '30000000-0000-4000-8000-000000000002',
    senderEmail: 'worker@test.com',
    content: 'Yes, 10:30 works for me. I will bring the ladder and tools.',
    isRead: false,
    createdAt: '2026-06-26T07:35:00.000Z',
  },
] as const;

const notificationSeeds = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    userEmail: 'customer@test.com',
    type: 'REQUEST_ACCEPTED',
    title: 'Request accepted',
    body: 'Daniel accepted your ceiling light installation request.',
    isRead: false,
    data: { requestId: '30000000-0000-4000-8000-000000000002' },
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    userEmail: 'worker@test.com',
    type: 'NEW_MESSAGE',
    title: 'New message',
    body: 'Test Customer sent you a message about the ceiling lights.',
    isRead: false,
    data: { requestId: '30000000-0000-4000-8000-000000000002' },
  },
  {
    id: '50000000-0000-4000-8000-000000000003',
    userEmail: 'customer@test.com',
    type: 'REQUEST_COMPLETED',
    title: 'Service completed',
    body: 'Your bathroom faucet replacement was completed.',
    isRead: true,
    data: { requestId: '30000000-0000-4000-8000-000000000004' },
  },
] as const;

function mustGet<K, V>(map: Map<K, V>, key: K, label: string): V {
  const value = map.get(key);
  if (!value) throw new Error(`Missing ${label}: ${String(key)}`);
  return value;
}

async function upsertCategory(seed: (typeof categorySeeds)[number]) {
  const existing = await db.serviceCategory.findFirst({
    where: {
      OR: [{ id: seed.id }, { name: seed.name }, ...seed.aliases.map((name) => ({ name }))],
    },
  });

  const data = {
    name: seed.name,
    icon: seed.icon,
    description: seed.description,
    isActive: true,
  };

  if (existing) {
    return db.serviceCategory.update({ where: { id: existing.id }, data });
  }

  return db.serviceCategory.create({ data: { id: seed.id, ...data } });
}

async function main() {
  console.log('Seeding demo data...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the seed script.');
  }

  console.log(`Using database host: ${new URL(process.env.DATABASE_URL).hostname}`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const categories = new Map<CategoryName, Awaited<ReturnType<typeof upsertCategory>>>();
  for (const seed of categorySeeds) {
    const category = await upsertCategory(seed);
    categories.set(seed.name, category);
  }

  const users = new Map<string, Awaited<ReturnType<typeof db.user.upsert>>>();
  for (const seed of userSeeds) {
    const user = await db.user.upsert({
      where: { email: seed.email },
      update: {
        fullName: seed.fullName,
        phone: seed.phone,
        passwordHash,
        role: seed.role,
        avatarUrl: seed.avatarUrl,
        isVerified: true,
        isActive: true,
      },
      create: {
        email: seed.email,
        passwordHash,
        fullName: seed.fullName,
        phone: seed.phone,
        role: seed.role,
        avatarUrl: seed.avatarUrl,
        isVerified: true,
        isActive: true,
      },
    });
    users.set(seed.email, user);
  }

  const workers = new Map<string, Awaited<ReturnType<typeof db.worker.upsert>>>();
  for (const seed of workerSeeds) {
    const user = mustGet(users, seed.email, 'worker user');
    const worker = await db.worker.upsert({
      where: { userId: user.id },
      update: {
        bio: seed.bio,
        yearsExp: seed.yearsExp,
        hourlyRate: seed.hourlyRate,
        fixedPrice: seed.fixedPrice,
        isAvailable: true,
        ratingAvg: seed.ratingAvg,
        totalReviews: seed.totalReviews,
        totalJobs: seed.totalJobs,
        workingRadius: seed.workingRadius,
        approvedAt: new Date('2026-06-01T08:00:00.000Z'),
      },
      create: {
        userId: user.id,
        bio: seed.bio,
        yearsExp: seed.yearsExp,
        hourlyRate: seed.hourlyRate,
        fixedPrice: seed.fixedPrice,
        isAvailable: true,
        ratingAvg: seed.ratingAvg,
        totalReviews: seed.totalReviews,
        totalJobs: seed.totalJobs,
        workingRadius: seed.workingRadius,
        approvedAt: new Date('2026-06-01T08:00:00.000Z'),
      },
    });

    await db.workerCategory.deleteMany({ where: { workerId: worker.id } });
    await db.workerAvailability.deleteMany({ where: { workerId: worker.id } });

    await db.workerCategory.createMany({
      data: seed.categories.map((name) => ({
        workerId: worker.id,
        categoryId: mustGet(categories, name, 'service category').id,
      })),
    });

    await db.workerAvailability.createMany({
      data: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
          id: `20000000-000${dayOfWeek}-4000-8000-${worker.id.slice(0, 12)}`,
          workerId: worker.id,
          dayOfWeek,
          startTime: dayOfWeek === 4 ? '08:00' : '09:00',
          endTime: dayOfWeek === 4 ? '14:00' : '18:00',
      })),
    });

    workers.set(seed.email, worker);
  }

  for (const seed of requestSeeds) {
    const customer = mustGet(users, seed.customerEmail, 'request customer');
    const worker = seed.workerEmail ? mustGet(workers, seed.workerEmail, 'request worker') : null;
    const category = mustGet(categories, seed.category, 'request category');

    await db.serviceRequest.upsert({
      where: { id: seed.id },
      update: {
        customerId: customer.id,
        workerId: worker?.id ?? null,
        categoryId: category.id,
        title: seed.title,
        description: seed.description,
        status: seed.status,
        lat: seed.lat,
        lng: seed.lng,
        address: seed.address,
        scheduledAt: new Date(seed.scheduledAt),
        priceAgreed: seed.priceAgreed,
        paymentMethod: seed.paymentMethod,
      },
      create: {
        id: seed.id,
        customerId: customer.id,
        workerId: worker?.id ?? null,
        categoryId: category.id,
        title: seed.title,
        description: seed.description,
        status: seed.status,
        lat: seed.lat,
        lng: seed.lng,
        address: seed.address,
        scheduledAt: new Date(seed.scheduledAt),
        priceAgreed: seed.priceAgreed,
        paymentMethod: seed.paymentMethod,
      },
    });
  }

  await db.payment.upsert({
    where: { requestId: '30000000-0000-4000-8000-000000000005' },
    update: {
      amount: '220.00',
      currency: 'ils',
      method: PaymentMethod.ONLINE,
      status: PaymentStatus.COMPLETED,
      stripePaymentIntent: 'pi_demo_completed_outlet_fix',
    },
    create: {
      requestId: '30000000-0000-4000-8000-000000000005',
      amount: '220.00',
      currency: 'ils',
      method: PaymentMethod.ONLINE,
      status: PaymentStatus.COMPLETED,
      stripePaymentIntent: 'pi_demo_completed_outlet_fix',
    },
  });

  for (const seed of reviewSeeds) {
    const reviewer = mustGet(users, seed.reviewerEmail, 'reviewer');
    const reviewee = mustGet(users, seed.revieweeEmail, 'reviewee');

    await db.review.upsert({
      where: { requestId: seed.requestId },
      update: {
        reviewerId: reviewer.id,
        revieweeId: reviewee.id,
        rating: seed.rating,
        comment: seed.comment,
      },
      create: {
        requestId: seed.requestId,
        reviewerId: reviewer.id,
        revieweeId: reviewee.id,
        rating: seed.rating,
        comment: seed.comment,
      },
    });
  }

  for (const seed of messageSeeds) {
    const sender = mustGet(users, seed.senderEmail, 'message sender');
    await db.message.upsert({
      where: { id: seed.id },
      update: {
        requestId: seed.requestId,
        senderId: sender.id,
        content: seed.content,
        isRead: seed.isRead,
        createdAt: new Date(seed.createdAt),
      },
      create: {
        id: seed.id,
        requestId: seed.requestId,
        senderId: sender.id,
        content: seed.content,
        isRead: seed.isRead,
        createdAt: new Date(seed.createdAt),
      },
    });
  }

  for (const seed of notificationSeeds) {
    const user = mustGet(users, seed.userEmail, 'notification user');
    await db.notification.upsert({
      where: { id: seed.id },
      update: {
        userId: user.id,
        type: seed.type,
        title: seed.title,
        body: seed.body,
        isRead: seed.isRead,
        data: seed.data,
      },
      create: {
        id: seed.id,
        userId: user.id,
        type: seed.type,
        title: seed.title,
        body: seed.body,
        isRead: seed.isRead,
        data: seed.data,
      },
    });
  }

  const customer = mustGet(users, 'customer@test.com', 'demo customer');
  for (const email of ['worker@test.com', 'maya.cleaning@test.com', 'amir.plumbing@test.com']) {
    const worker = mustGet(workers, email, 'favorite worker');
    await db.favorite.upsert({
      where: { customerId_workerId: { customerId: customer.id, workerId: worker.id } },
      update: {},
      create: { customerId: customer.id, workerId: worker.id },
    });
  }

  console.log(`Seeded ${categorySeeds.length} categories`);
  console.log(`Seeded ${userSeeds.length} users, including customer@test.com and worker@test.com`);
  console.log(`Seeded ${workerSeeds.length} worker profiles`);
  console.log(`Seeded ${requestSeeds.length} service requests`);
  console.log(`Seeded ${reviewSeeds.length} reviews`);
  console.log(`Seeded ${notificationSeeds.length} notifications`);
  console.log('Demo password for all seeded users: Test12345');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

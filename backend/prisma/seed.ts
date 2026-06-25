import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const categoriesSeed = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Electrician',
    icon: 'flash-outline',
    description: 'Electrical repairs, outlets, lighting, and panels.',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Plumber',
    icon: 'water-outline',
    description: 'Leaks, sinks, toilets, drains, and water fixtures.',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Painter',
    icon: 'color-palette-outline',
    description: 'Interior painting, touch-ups, and wall repair.',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Carpenter',
    icon: 'hammer-outline',
    description: 'Doors, shelves, cabinets, and small wood repairs.',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Cleaning',
    icon: 'sparkles-outline',
    description: 'Home cleaning and move-in or move-out help.',
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'AC Repair',
    icon: 'snow-outline',
    description: 'Air conditioner repair, cleaning, and diagnostics.',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    name: 'Furniture Moving',
    icon: 'cube-outline',
    description: 'Small moves, furniture lifting, and assembly help.',
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    name: 'Appliances',
    icon: 'hardware-chip-outline',
    description: 'Appliance setup and simple repairs.',
  },
];

async function main() {
  console.log('🌱 Seeding database…');

  // Keep seed data deterministic so repeated local testing does not duplicate rows.
  await db.message.deleteMany();
  await db.notification.deleteMany();
  await db.payment.deleteMany();
  await db.review.deleteMany();
  await db.requestImage.deleteMany();
  await db.favorite.deleteMany();
  await db.serviceRequest.deleteMany();
  await db.workerAvailability.deleteMany();
  await db.workerCategory.deleteMany();
  await db.serviceCategory.deleteMany();

  const categories = await Promise.all(
    categoriesSeed.map((category) =>
      db.serviceCategory.create({ data: category }),
    ),
  );
  console.log(`✅ ${categories.length} categories seeded`);

  // ── Test customer ──────────────────────────────────────────────────────
  const customerHash = await bcrypt.hash('Password1', 12);
  const customer = await db.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: {
      email: 'customer@test.com',
      passwordHash: customerHash,
      fullName: 'Test Customer',
      role: 'CUSTOMER',
      isVerified: true,
    },
  });
  console.log('✅ Test customer:', customer.email);

  // ── Test worker ────────────────────────────────────────────────────────
  const workerHash = await bcrypt.hash('Password1', 12);
  const workerUser = await db.user.upsert({
    where: { email: 'worker@test.com' },
    update: {},
    create: {
      email: 'worker@test.com',
      passwordHash: workerHash,
      fullName: 'Test Worker',
      role: 'WORKER',
      isVerified: true,
    },
  });

  const worker = await db.worker.upsert({
    where: { userId: workerUser.id },
    update: {
      bio: 'Experienced electrician with 5 years in the field.',
      yearsExp: 5,
      hourlyRate: 45,
      isAvailable: true,
      approvedAt: new Date(),
      totalJobs: 1,
      ratingAvg: 5,
      totalReviews: 1,
    },
    create: {
      userId: workerUser.id,
      bio: 'Experienced electrician with 5 years in the field.',
      yearsExp: 5,
      hourlyRate: 45,
      isAvailable: true,
      approvedAt: new Date(),
      totalJobs: 1,
      ratingAvg: 5,
      totalReviews: 1,
    },
  });

  await db.workerCategory.createMany({
    data: [
      { workerId: worker.id, categoryId: categoriesSeed[0].id },
      { workerId: worker.id, categoryId: categoriesSeed[1].id },
      { workerId: worker.id, categoryId: categoriesSeed[5].id },
    ],
  });

  await db.workerAvailability.createMany({
    data: [
      { workerId: worker.id, dayOfWeek: 0, startTime: '09:00', endTime: '17:00' },
      { workerId: worker.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { workerId: worker.id, dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { workerId: worker.id, dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { workerId: worker.id, dayOfWeek: 4, startTime: '09:00', endTime: '14:00' },
    ],
  });

  const pendingRequest = await db.serviceRequest.create({
    data: {
      customerId: customer.id,
      categoryId: categoriesSeed[0].id,
      title: 'Install new ceiling light',
      description: 'Need help installing a ceiling light in the living room.',
      lat: 32.0853,
      lng: 34.7818,
      address: 'Dizengoff St 100, Tel Aviv',
      paymentMethod: 'CASH',
    },
  });

  await db.serviceRequest.create({
    data: {
      customerId: customer.id,
      workerId: worker.id,
      categoryId: categoriesSeed[1].id,
      title: 'Kitchen sink leak',
      description: 'Small leak under the sink. Please bring basic plumbing tools.',
      status: 'ACCEPTED',
      lat: 32.0809,
      lng: 34.7806,
      address: 'King George St 40, Tel Aviv',
      paymentMethod: 'CASH',
      priceAgreed: 180,
    },
  });

  const completedRequest = await db.serviceRequest.create({
    data: {
      customerId: customer.id,
      workerId: worker.id,
      categoryId: categoriesSeed[0].id,
      title: 'Fix bedroom outlet',
      description: 'Outlet was loose and stopped working.',
      status: 'COMPLETED',
      lat: 32.074,
      lng: 34.792,
      address: 'Rothschild Blvd 12, Tel Aviv',
      paymentMethod: 'CASH',
      priceAgreed: 220,
    },
  });

  await db.payment.create({
    data: {
      requestId: completedRequest.id,
      amount: 220,
      currency: 'ils',
      method: 'CASH',
      status: 'COMPLETED',
    },
  });

  await db.review.create({
    data: {
      requestId: completedRequest.id,
      reviewerId: customer.id,
      revieweeId: workerUser.id,
      rating: 5,
      comment: 'Fast, clean, and professional.',
    },
  });

  await db.message.create({
    data: {
      requestId: pendingRequest.id,
      senderId: customer.id,
      content: 'Hi, can someone come today?',
    },
  });

  console.log('✅ Test worker:', workerUser.email);
  console.log('✅ Demo requests seeded');
  console.log('🌱 Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

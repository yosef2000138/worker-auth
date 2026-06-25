import { db } from '../../config/database';

export async function listActiveCategories() {
  return db.serviceCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true, icon: true, description: true, isActive: true },
    orderBy: { name: 'asc' },
  });
}

import { Prisma } from '@prisma/client';
import { db } from '../config/database';

const SERIALIZABLE_TRANSACTION_ATTEMPTS = 12;
const BASE_RETRY_DELAY_MS = 5;

function isRetryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function retryDelay(attempt: number) {
  const cappedBackoff = Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), 100);
  return cappedBackoff + Math.floor(Math.random() * BASE_RETRY_DELAY_MS);
}

export async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === SERIALIZABLE_TRANSACTION_ATTEMPTS) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay(attempt)));
    }
  }

  throw new Error('Serializable transaction retry limit reached');
}

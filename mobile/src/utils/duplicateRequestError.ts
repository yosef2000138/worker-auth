export type DuplicateActiveRequestInfo = {
  requestId: string;
  status?: string;
};

export function getDuplicateActiveRequestInfo(error: unknown): DuplicateActiveRequestInfo | null {
  if (typeof error !== 'object' || error === null) return null;
  if (!('code' in error) || String((error as { code?: unknown }).code) !== 'DUPLICATE_ACTIVE_REQUEST') return null;

  const details = (error as { details?: unknown }).details;
  if (typeof details !== 'object' || details === null) return null;

  const id = (details as { id?: unknown }).id;
  if (typeof id !== 'string' || id.length === 0) return null;

  const status = (details as { status?: unknown }).status;
  return {
    requestId: id,
    ...(typeof status === 'string' && { status }),
  };
}

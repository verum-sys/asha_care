/** Only return to the originating workspace or this patient's record. */
export function cbacReturnPath(id: string | undefined, state: unknown, tier: string | null, unit: string | null): string {
  const returnTo = state && typeof state === 'object' ? (state as { returnTo?: unknown }).returnTo : undefined;
  if (typeof returnTo === 'string') {
    if (/^\/tier\/(asha|phc|dh|tcc)(?:\?unit=[abc])?$/.test(returnTo)) return returnTo;
    if (id && returnTo === `/case/${id}`) return returnTo;
  }
  if (id) return `/case/${id}`;
  if (tier && ['asha', 'phc', 'dh', 'tcc'].includes(tier)) return `/tier/${tier}${unit && ['a', 'b', 'c'].includes(unit) ? `?unit=${unit}` : ''}`;
  return '/';
}

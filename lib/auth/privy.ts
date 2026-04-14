import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function verifyPrivyToken(authToken: string) {
  if (!authToken) return null;
  // Simple token-based auth: treat the token as the user ID
  return { userId: authToken };
}

export async function syncUserFromClaims(claims: unknown) {
  if (!claims || typeof claims !== 'object') return null;

  const record = claims as Record<string, unknown>;
  const privyId = record.userId;
  if (typeof privyId !== 'string' || privyId.length === 0) return null;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.privyId, privyId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ privyId })
    .returning();

  return created;
}

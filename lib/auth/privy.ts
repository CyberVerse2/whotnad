import { PrivyClient } from '@privy-io/server-auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;
const privyVerificationKey = process.env.PRIVY_VERIFICATION_KEY;

if (!privyAppId || !privyAppSecret) {
  console.warn('Privy credentials not set — auth will not work');
}

export const privyClient = new PrivyClient(
  privyAppId ?? '',
  privyAppSecret ?? ''
);

export async function verifyPrivyToken(authToken: string) {
  try {
    const claims = await privyClient.verifyAuthToken(
      authToken,
      privyVerificationKey || ''
    );
    return claims;
  } catch (error) {
    console.warn('Privy token verification failed', error);
    return null;
  }
}

function getLinkedWalletAddress(accounts: unknown): string | null {
  if (!Array.isArray(accounts)) return null;

  for (const account of accounts) {
    if (!account || typeof account !== 'object') continue;

    const record = account as Record<string, unknown>;
    const type = record.type;
    const address = record.address;

    if (
      (type === 'wallet' || type === 'smart_wallet') &&
      typeof address === 'string' &&
      address.length > 0
    ) {
      return address;
    }
  }

  return null;
}

export function extractWalletAddressFromClaims(claims: unknown): string | null {
  if (!claims || typeof claims !== 'object') return null;

  const record = claims as Record<string, unknown>;

  const directWalletAddress = record.walletAddress;
  if (typeof directWalletAddress === 'string' && directWalletAddress.length > 0) {
    return directWalletAddress;
  }

  const snakeWalletAddress = record.wallet_address;
  if (typeof snakeWalletAddress === 'string' && snakeWalletAddress.length > 0) {
    return snakeWalletAddress;
  }

  return (
    getLinkedWalletAddress(record.linkedAccounts) ??
    getLinkedWalletAddress(record.linked_accounts)
  );
}

export async function syncUserFromClaims(claims: unknown) {
  if (!claims || typeof claims !== 'object') return null;

  const record = claims as Record<string, unknown>;
  const privyId = record.userId;
  if (typeof privyId !== 'string' || privyId.length === 0) return null;

  const walletAddress = extractWalletAddressFromClaims(claims) ?? '';

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.privyId, privyId))
    .limit(1);

  if (existing) {
    if (walletAddress && existing.walletAddress !== walletAddress) {
      const [updated] = await db
        .update(users)
        .set({ walletAddress })
        .where(eq(users.id, existing.id))
        .returning();

      return updated;
    }

    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      privyId,
      walletAddress,
    })
    .returning();

  return created;
}

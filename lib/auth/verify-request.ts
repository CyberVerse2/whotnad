import type { NextRequest } from 'next/server';
import { verifyPrivyToken, syncUserFromClaims } from './privy';

/**
 * Extract and verify the Privy auth token from a request.
 * Returns the user's Privy ID if valid, null otherwise.
 *
 * Checks both:
 * - x-privy-token header (set by proxy.ts)
 * - Authorization: Bearer header (direct from client)
 */
export async function verifyRequest(request: NextRequest): Promise<string | null> {
  const token =
    request.headers.get('x-privy-token') ??
    request.headers.get('authorization')?.replace('Bearer ', '') ??
    null;

  if (!token) return null;

  const claims = await verifyPrivyToken(token);
  if (!claims) return null;

  try {
    await syncUserFromClaims(claims);
  } catch (error) {
    console.warn('Failed to sync user from auth claims', error);
  }

  return claims.userId;
}

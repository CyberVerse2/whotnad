import { cookies } from 'next/headers';

export async function getPrivyToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('privy-token')?.value;
  return token ?? null;
}

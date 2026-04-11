export interface DrandBeacon {
  round: number;
  randomness: string;
  signature: string;
}

const DRAND_URL = process.env.DRAND_URL || 'https://api.drand.sh';

export async function fetchDrandBeacon(): Promise<DrandBeacon> {
  const response = await fetch(`${DRAND_URL}/public/latest`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Drand beacon: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    round: data.round,
    randomness: data.randomness,
    signature: data.signature,
  };
}

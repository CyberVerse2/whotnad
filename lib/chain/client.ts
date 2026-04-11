import { createPublicClient, createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-testnet.g.alchemy.com/v2/Clsvql8WPEP8Lz4QI2-4e0A4RND9GT6a'] },
  },
  blockExplorers: {
    default: {
      name: 'Monad Testnet Explorer',
      url: 'https://monad-testnet.socialscan.io',
    },
  },
});

export const monadMainnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://monad.socialscan.io',
    },
  },
});

const chain = process.env.NEXT_PUBLIC_MONAD_NETWORK === 'mainnet' ? monadMainnet : monadTestnet;

export const publicClient = createPublicClient({
  chain,
  transport: http(),
});

export function getPoolWalletClient() {
  const privateKey = process.env.POOL_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('POOL_WALLET_PRIVATE_KEY not set');
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return {
    account,
    client: createWalletClient({
      account,
      chain,
      transport: http(),
    }),
  };
}

export { chain };

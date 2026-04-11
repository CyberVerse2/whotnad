'use client';

import { PrivyProvider as BasePrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://monad-testnet.g.alchemy.com/v2/Clsvql8WPEP8Lz4QI2-4e0A4RND9GT6a'] },
  },
  blockExplorers: {
    default: {
      name: 'Monad Testnet Explorer',
      url: 'https://monad-testnet.socialscan.io',
    },
  },
};

export function PrivyProviderWrapper({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <BasePrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#836EF9',
          showWalletLoginFirst: true,
        },
        loginMethods: ['wallet'],
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}

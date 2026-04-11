import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from '../lib/chain/client';

const FUNDING_KEY = process.env.FUNDING_WALLET_PRIVATE_KEY;
if (!FUNDING_KEY) {
  console.error('Set FUNDING_WALLET_PRIVATE_KEY in .env');
  process.exit(1);
}

const account = privateKeyToAccount(FUNDING_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(),
});

const transfers: { label: string; to: `0x${string}`; amount: string }[] = [
  {
    label: 'Contract Deployer',
    to: '0x64787E74E36Fd2084374A192A9Ea11eC16010773',
    amount: '2',
  },
  {
    label: 'Platform Wallet',
    to: '0x6E8e84C824eb47F3fe568C7A528123331AdC46C7',
    amount: '5',
  },
  {
    label: 'Player Wallet',
    to: '0x1f7204bd4dd27a1c253d7CC753EC0CaeBaF2c28E',
    amount: '2',
  },
];

async function main() {
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Source wallet: ${account.address}`);
  console.log(`Balance: ${formatEther(balance)} MON\n`);

  const totalNeeded = transfers.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  if (parseFloat(formatEther(balance)) < totalNeeded) {
    console.error(`Insufficient balance. Need ${totalNeeded} MON, have ${formatEther(balance)} MON`);
    process.exit(1);
  }

  for (const { label, to, amount } of transfers) {
    console.log(`Sending ${amount} MON to ${label} (${to})...`);

    const hash = await walletClient.sendTransaction({
      to,
      value: parseEther(amount),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  tx: ${hash}`);
    console.log(`  status: ${receipt.status}\n`);
  }

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`Remaining balance: ${formatEther(remaining)} MON`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import {
  parseEther,
  formatEther,
  keccak256,
  encodePacked,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount, signMessage } from 'viem/accounts';
import { publicClient, getPoolWalletClient, chain } from './client';

// ── Contract ABI (only the functions we call) ──
const TOURNAMENT_POOL_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'submitResult',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'winner', type: 'address' },
      { name: 'deckHash', type: 'bytes32' },
      { name: 'finalStateHash', type: 'bytes32' },
      { name: 'sig', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'withdrawRake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getMatch',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'player1', type: 'address' },
          { name: 'player2', type: 'address' },
          { name: 'winner', type: 'address' },
          { name: 'deckHash', type: 'bytes32' },
          { name: 'finalStateHash', type: 'bytes32' },
          { name: 'status', type: 'uint8' },
          { name: 'fundedAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'accumulatedRake',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const ENTRY_FEE = parseEther('1');
const PAYOUT_AMOUNT = parseEther('1.8');
const RAKE_AMOUNT = parseEther('0.2');

function getContractAddress(): Address {
  const addr = process.env.TOURNAMENT_POOL_ADDRESS;
  if (!addr) throw new Error('TOURNAMENT_POOL_ADDRESS not set');
  return addr as Address;
}

export function getPoolWalletAddress(): Address {
  return getPoolWalletClient().account.address;
}

export async function depositToMatchOnChain(matchId: Hex): Promise<string> {
  const { client } = getPoolWalletClient();
  const contractAddress = getContractAddress();

  const hash = await client.writeContract({
    address: contractAddress,
    abi: TOURNAMENT_POOL_ABI,
    functionName: 'deposit',
    args: [matchId],
    value: ENTRY_FEE,
  });

  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

export async function claimMatchAsPool(matchId: Hex): Promise<string> {
  const { client } = getPoolWalletClient();
  const contractAddress = getContractAddress();

  const hash = await client.writeContract({
    address: contractAddress,
    abi: TOURNAMENT_POOL_ABI,
    functionName: 'claim',
    args: [matchId],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

/**
 * Sign a match result for on-chain submission.
 * The operator (backend) signs: keccak256(matchId, winner, deckHash, finalStateHash)
 */
export async function signMatchResult(
  matchId: Hex,
  winner: Address,
  deckHash: Hex,
  finalStateHash: Hex
): Promise<Hex> {
  const { account } = getPoolWalletClient();

  const messageHash = keccak256(
    encodePacked(
      ['bytes32', 'address', 'bytes32', 'bytes32'],
      [matchId, winner, deckHash, finalStateHash]
    )
  );

  const signature = await account.signMessage({
    message: { raw: messageHash as `0x${string}` },
  });

  return signature;
}

/**
 * Submit a match result to the TournamentPool contract.
 * Called by the backend after a game finishes.
 */
export async function submitResultOnChain(
  matchId: Hex,
  winner: Address,
  deckHash: Hex,
  finalStateHash: Hex
): Promise<string> {
  const { client } = getPoolWalletClient();
  const contractAddress = getContractAddress();

  const signature = await signMatchResult(matchId, winner, deckHash, finalStateHash);

  const hash = await client.writeContract({
    address: contractAddress,
    abi: TOURNAMENT_POOL_ABI,
    functionName: 'submitResult',
    args: [matchId, winner, deckHash, finalStateHash, signature],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

/**
 * Withdraw accumulated rake from the contract.
 */
export async function withdrawRake(): Promise<string> {
  const { client } = getPoolWalletClient();
  const contractAddress = getContractAddress();

  const hash = await client.writeContract({
    address: contractAddress,
    abi: TOURNAMENT_POOL_ABI,
    functionName: 'withdrawRake',
    args: [],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

/**
 * Get on-chain match data from the contract.
 */
export async function getOnChainMatch(matchId: Hex) {
  const contractAddress = getContractAddress();

  const result = await publicClient.readContract({
    address: contractAddress,
    abi: TOURNAMENT_POOL_ABI,
    functionName: 'getMatch',
    args: [matchId],
  });

  return result;
}

/**
 * Get accumulated rake amount.
 */
export async function getAccumulatedRake(): Promise<string> {
  const contractAddress = getContractAddress();

  const result = await publicClient.readContract({
    address: contractAddress,
    abi: TOURNAMENT_POOL_ABI,
    functionName: 'accumulatedRake',
    args: [],
  });

  return formatEther(result);
}

/**
 * Get contract MON balance.
 */
export async function getPoolBalance(): Promise<string> {
  const contractAddress = getContractAddress();
  const balance = await publicClient.getBalance({ address: contractAddress });
  return formatEther(balance);
}

/**
 * Convert a string match ID to a bytes32 hash for the contract.
 */
export function matchIdToBytes32(matchId: string): Hex {
  return keccak256(encodePacked(['string'], [matchId]));
}

/**
 * Hash the final game state for on-chain verification.
 */
export function hashFinalState(gameStateJson: string): Hex {
  return keccak256(encodePacked(['string'], [gameStateJson]));
}

export { ENTRY_FEE, PAYOUT_AMOUNT, RAKE_AMOUNT };

'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { monadTestnet } from '@/lib/chain/client';

const TOURNAMENT_POOL_ABI = [
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
] as const;

interface MatchRecord {
  id: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  status: string;
  contractMatchId: string | null;
  resultTxHash: string | null;
  claimed: boolean;
  turnsTaken: number | null;
  winnerPoints: number | null;
  loserPoints: number | null;
  createdAt: string;
}

export default function ProfilePage() {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingMatch, setClaimingMatch] = useState<string | null>(null);
  const [claimedMatches, setClaimedMatches] = useState<Set<string>>(new Set());
  const [claimError, setClaimError] = useState<string | null>(null);

  const userId = user?.id ?? null;
  const walletAddress = user?.wallet?.address;

  useEffect(() => {
    if (!authenticated || !userId) return;

    async function fetchMatches() {
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/game/history', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMatches(data.matches);
          // Track already-claimed matches
          const claimed = new Set<string>();
          for (const m of data.matches) {
            if (m.claimed) claimed.add(m.id);
          }
          setClaimedMatches(claimed);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
  }, [authenticated, userId, getAccessToken]);

  const handleClaim = useCallback(async (contractMatchId: string, matchId: string) => {
    const contractAddress = process.env.NEXT_PUBLIC_TOURNAMENT_POOL_ADDRESS;
    if (!contractAddress) {
      alert('Contract address not configured');
      return;
    }

    const wallet = wallets[0];
    if (!wallet) {
      alert('No wallet connected');
      return;
    }

    setClaimingMatch(matchId);
    setClaimError(null);

    try {
      await wallet.switchChain(10143);

      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        chain: monadTestnet,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(),
      });

      const [account] = await walletClient.getAddresses();

      const txHash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: TOURNAMENT_POOL_ABI,
        functionName: 'claim',
        args: [contractMatchId as `0x${string}`],
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const token = await getAccessToken();
      const confirmRes = await fetch('/api/game/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ matchId }),
      });

      if (!confirmRes.ok) {
        const data = await confirmRes.json().catch(() => ({ error: 'Failed to persist claim' }));
        throw new Error(data.error ?? 'Failed to persist claim');
      }

      setClaimedMatches((prev) => new Set([...prev, matchId]));
    } catch (err) {
      console.error('Claim failed:', err);
      setClaimError(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setClaimingMatch(null);
    }
  }, [getAccessToken, wallets]);

  if (!ready) {
    return (
      <div className="felt-texture" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
      }}>
        <span className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          LOADING...
        </span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="felt-texture" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
      }}>
        <Link href="/lobby" style={{ color: 'var(--green-bright)', textDecoration: 'none' }}>
          Connect wallet to view profile
        </Link>
      </div>
    );
  }

  const finishedMatches = matches.filter((m) => m.status === 'finished');
  const wins = finishedMatches.filter((m) => m.winnerId === userId).length;
  const losses = finishedMatches.filter((m) => m.winnerId && m.winnerId !== userId).length;
  const totalPoints = finishedMatches.reduce((sum, m) => {
    if (m.winnerId === userId) return sum + (m.winnerPoints ?? 0);
    return sum + (m.loserPoints ?? 0);
  }, 0);

  return (
    <div className="felt-texture" style={{ minHeight: '100vh' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid var(--surface-2)',
      }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
          color: 'var(--text-primary)', textDecoration: 'none', letterSpacing: '0.02em',
        }}>
          WHOT<span style={{ color: 'var(--gold-base)' }}>!</span>
        </Link>
        <Link href="/lobby" style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
          letterSpacing: '0.08em', background: 'var(--accent)',
          color: '#fff', padding: '8px 16px', borderRadius: 4,
          textDecoration: 'none',
        }}>
          PLAY
        </Link>
      </nav>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <div className="animate-slide-up" style={{ marginBottom: 32 }}>
          <h1 className="font-display" style={{
            fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4,
          }}>
            PROFILE
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {walletAddress
              ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : userId?.slice(0, 16)
            }
          </p>
        </div>

        <div className="animate-slide-up stagger-1" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 32,
        }}>
          <StatBox label="WINS" value={wins} color="var(--green-bright)" />
          <StatBox label="LOSSES" value={losses} color="var(--danger)" />
          <StatBox label="POINTS" value={totalPoints} color="var(--gold-base)" />
        </div>

        <div className="animate-slide-up stagger-2">
          <h2 className="font-display" style={{
            fontSize: 16, fontWeight: 800, color: 'var(--text-primary)',
            letterSpacing: '0.06em', marginBottom: 12,
          }}>
            MATCH HISTORY
          </h2>

          {claimError && (
            <div style={{
              background: 'oklch(0.30 0.08 25)',
              border: '1px solid var(--danger)',
              color: 'oklch(0.85 0.06 25)',
              padding: '10px 12px',
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 12,
            }}>
              {claimError}
            </div>
          )}

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p>
          ) : finishedMatches.length === 0 ? (
            <div style={{
              background: 'var(--surface-1)', borderRadius: 6, padding: '32px 16px', textAlign: 'center',
            }}>
              <p className="font-display" style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em',
              }}>
                NO MATCHES YET
              </p>
              <Link href="/lobby" style={{ color: 'var(--green-bright)', fontSize: 13, textDecoration: 'none' }}>
                Play your first game
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {finishedMatches.map((match) => {
                const won = match.winnerId === userId;
                const hasResult = !!match.resultTxHash;
                const isClaimed = claimedMatches.has(match.id);
                const canClaim = won && hasResult && !isClaimed;
                const claiming = claimingMatch === match.id;

                return (
                  <div key={match.id} style={{
                    background: 'var(--surface-1)', borderRadius: 6, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="font-display" style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                        color: won ? 'var(--green-bright)' : 'var(--danger)',
                        width: 32,
                      }}>
                        {won ? 'WIN' : 'LOSS'}
                      </span>
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {match.turnsTaken ?? '?'} turns
                        </p>
                        <p className="font-display" style={{
                          fontSize: 14, fontWeight: 800,
                          color: won ? 'var(--gold-base)' : 'var(--text-muted)',
                        }}>
                          +{won ? match.winnerPoints ?? 0 : match.loserPoints ?? 0} pts
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {match.resultTxHash && (
                        <a
                          href={`https://monad-testnet.socialscan.io/tx/${match.resultTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}
                        >
                          tx
                        </a>
                      )}

                      {canClaim && match.contractMatchId && (
                        <button
                          onClick={() => handleClaim(match.contractMatchId!, match.id)}
                          disabled={claiming}
                          style={{
                            fontFamily: 'var(--font-display)', fontWeight: 800,
                            fontSize: 11, letterSpacing: '0.06em',
                            background: 'var(--gold-base)', color: 'oklch(0.15 0.02 85)',
                            padding: '6px 14px', borderRadius: 4, border: 'none',
                            cursor: claiming ? 'wait' : 'pointer',
                            opacity: claiming ? 0.6 : 1,
                          }}
                        >
                          {claiming ? 'CLAIMING...' : 'CLAIM 1.8 MON'}
                        </button>
                      )}

                      {isClaimed && (
                        <span className="font-display" style={{
                          fontSize: 10, fontWeight: 700, color: 'var(--green-bright)',
                          letterSpacing: '0.06em',
                        }}>
                          CLAIMED
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--surface-1)', borderRadius: 6, padding: '16px 12px', textAlign: 'center',
    }}>
      <p className="font-display" style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4,
      }}>
        {label}
      </p>
      <p className="font-display" style={{ fontSize: 24, fontWeight: 900, color }}>
        {value}
      </p>
    </div>
  );
}

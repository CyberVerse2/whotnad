'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGame } from '@/hooks/use-game';
import { Board } from '@/components/game/board';
import Link from 'next/link';
import { createPublicClient, createWalletClient, custom, encodePacked, formatEther, http, keccak256, parseEther } from 'viem';
import { monadTestnet } from '@/lib/chain/client';

const TOURNAMENT_POOL_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'refund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
] as const;

export default function PlayPage() {
  const { user, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = user?.id ?? null;
  const walletAddress = user?.wallet?.address ?? wallets[0]?.address ?? null;
  const matchIdFromUrl = searchParams.get('matchId');
  const tournamentPoolAddress = process.env.NEXT_PUBLIC_TOURNAMENT_POOL_ADDRESS;
  const [depositing, setDepositing] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [monBalance, setMonBalance] = useState<string | null>(null);

  const {
    phase,
    gameState,
    winner,
    points,
    error,
    connected,
    depositStatus,
    refreshDepositStatus,
    log,
    lastAgentThinkMs,
    playCard,
    drawCard,
    declareLastCard,
    forfeit,
    resetGame,
  } = useGame(authenticated ? userId : null, matchIdFromUrl);

  const handleLeave = useCallback(() => {
    resetGame();
    router.push('/lobby');
  }, [resetGame, router]);

  const requiresFunding = Boolean(tournamentPoolAddress);
  const shouldPollFunding =
    Boolean(matchIdFromUrl) &&
    requiresFunding &&
    phase === 'playing' &&
    !(depositStatus?.funded ?? false);

  useEffect(() => {
    if (!matchIdFromUrl || !shouldPollFunding) return;
    const timer = setInterval(() => {
      void refreshDepositStatus();
    }, 2000);
    void refreshDepositStatus();
    return () => clearInterval(timer);
  }, [matchIdFromUrl, refreshDepositStatus, shouldPollFunding]);

  // Fetch MON balance
  useEffect(() => {
    if (!walletAddress) return;
    const client = createPublicClient({ chain: monadTestnet, transport: http() });
    let cancelled = false;

    async function fetchBalance() {
      try {
        const bal = await client.getBalance({ address: walletAddress as `0x${string}` });
        if (!cancelled) setMonBalance(formatEther(bal));
      } catch { /* ignore */ }
    }

    fetchBalance();
    const timer = setInterval(fetchBalance, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [walletAddress]);

  const fundingReady = !requiresFunding || (depositStatus?.funded ?? false);
  const humanDeposited = useMemo(() => {
    if (!walletAddress || !depositStatus) return false;
    const lower = walletAddress.toLowerCase();
    return depositStatus.player1.toLowerCase() === lower || depositStatus.player2.toLowerCase() === lower;
  }, [walletAddress, depositStatus]);
  const agentDeposited = useMemo(() => {
    if (!depositStatus || !walletAddress) return false;
    const lower = walletAddress.toLowerCase();
    const players = [depositStatus.player1.toLowerCase(), depositStatus.player2.toLowerCase()];
    return players.some((address) => address !== lower && address !== '0x0000000000000000000000000000000000000000');
  }, [walletAddress, depositStatus]);

  if (!ready) {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <span className="font-display" style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
        }}>
          LOADING...
        </span>
      </div>
    );
  }

  if (!authenticated || !userId) {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <Link href="/lobby" style={{ color: 'var(--green-bright)', textDecoration: 'none' }}>
          Go to lobby to connect
        </Link>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 10,
      }}>
        <div style={{
          width: 14,
          height: 14,
          borderRight: '2px solid var(--gold-base)',
          borderBottom: '2px solid var(--gold-base)',
          borderLeft: '2px solid var(--gold-base)',
          borderTop: '2px solid transparent',
          borderRadius: '50%',
        }} className="animate-spin" />
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Connecting...
        </span>
      </div>
    );
  }

  // Don't show funding screen until deposit status has actually loaded
  if (phase === 'playing' && matchIdFromUrl && requiresFunding && depositStatus === null) {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 10,
      }}>
        <div style={{
          width: 14,
          height: 14,
          borderRight: '2px solid var(--accent)',
          borderBottom: '2px solid var(--accent)',
          borderLeft: '2px solid var(--accent)',
          borderTop: '2px solid transparent',
          borderRadius: '50%',
        }} className="animate-spin" />
        <span className="font-display" style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
        }}>
          LOADING MATCH...
        </span>
      </div>
    );
  }

  if (phase === 'playing' && matchIdFromUrl && requiresFunding && !fundingReady) {
    return (
      <FundingScreen
        depositing={depositing}
        refunding={refunding}
        error={depositError ?? error}
        humanDeposited={humanDeposited}
        agentDeposited={agentDeposited}
        refundable={depositStatus?.refundable ?? false}
        onDeposit={async () => {
          const contractAddress = tournamentPoolAddress;
          const wallet = wallets[0];

          if (!contractAddress) {
            setDepositError('Tournament pool is not configured');
            return;
          }

          if (!wallet) {
            setDepositError('No wallet connected');
            return;
          }

          setDepositing(true);
          setDepositError(null);

          try {
            // Switch to Monad Testnet if not already on it
            await wallet.switchChain(10143);

            const provider = await wallet.getEthereumProvider();
            const client = createWalletClient({
              chain: monadTestnet,
              transport: custom(provider),
            });
            const [account] = await client.getAddresses();

            const contractMatchId = keccak256(
              encodePacked(['string'], [matchIdFromUrl])
            );

            await client.writeContract({
              address: contractAddress as `0x${string}`,
              abi: TOURNAMENT_POOL_ABI,
              functionName: 'deposit',
              args: [contractMatchId],
              account,
              value: parseEther('1'),
            });

            await refreshDepositStatus();
          } catch (depositErr: unknown) {
            const msg = depositErr instanceof Error ? depositErr.message : String(depositErr);
            if (msg.includes('denied') || msg.includes('rejected') || msg.includes('User denied')) {
              setDepositError('Transaction was cancelled');
            } else {
              console.error('Deposit failed:', depositErr);
              setDepositError(msg || 'Deposit failed');
            }
          } finally {
            setDepositing(false);
          }
        }}
        onRefund={async () => {
          const contractAddress = tournamentPoolAddress;
          const wallet = wallets[0];

          if (!contractAddress || !matchIdFromUrl) {
            setDepositError('Tournament pool is not configured');
            return;
          }

          if (!wallet) {
            setDepositError('No wallet connected');
            return;
          }

          setRefunding(true);
          setDepositError(null);

          try {
            await wallet.switchChain(10143);

            const provider = await wallet.getEthereumProvider();
            const client = createWalletClient({
              chain: monadTestnet,
              transport: custom(provider),
            });
            const [account] = await client.getAddresses();

            const contractMatchId = keccak256(
              encodePacked(['string'], [matchIdFromUrl])
            );

            await client.writeContract({
              address: contractAddress as `0x${string}`,
              abi: TOURNAMENT_POOL_ABI,
              functionName: 'refund',
              args: [contractMatchId],
              account,
            });

            await refreshDepositStatus();
            resetGame();
            router.push('/lobby');
          } catch (refundErr: unknown) {
            const msg = refundErr instanceof Error ? refundErr.message : String(refundErr);
            if (msg.includes('denied') || msg.includes('rejected') || msg.includes('User denied')) {
              setDepositError('Transaction was cancelled');
            } else {
              console.error('Refund failed:', refundErr);
              setDepositError(msg || 'Refund failed');
            }
          } finally {
            setRefunding(false);
          }
        }}
      />
    );
  }

  // Game over
  if (phase === 'finished' && gameState && points) {
    const isWinner = winner === userId;
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 24,
      }}>
        <h1 className={`font-display ${isWinner ? 'animate-win' : 'animate-slide-up'}`} style={{
          fontSize: 'clamp(3rem, 10vw, 5rem)',
          fontWeight: 900,
          color: isWinner ? 'var(--gold-base)' : 'var(--danger)',
          lineHeight: 0.9,
        }}>
          {isWinner ? 'YOU WIN' : 'YOU LOSE'}
        </h1>

        <div className="animate-slide-up stagger-2" style={{
          background: 'var(--surface-1)',
          borderRadius: 6,
          padding: 24,
          minWidth: 260,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PointRow label="BASE" value={isWinner ? points.basePoints : points.loserPoints} />
            {isWinner && (
              <>
                <PointRow label="DOMINANCE" value={points.dominanceBonus} color="var(--gold-base)" prefix="+" />
                <PointRow label="SPEED" value={points.speedBonus} color="var(--green-bright)" prefix="+" />
                {points.streakMultiplier > 1 && (
                  <PointRow
                    label="STREAK"
                    value={`${points.streakMultiplier}x`}
                    color="var(--gold-bright)"
                  />
                )}
                <div style={{
                  borderTop: '1px solid var(--surface-3)',
                  paddingTop: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}>
                  <span className="font-display" style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: 'var(--text-primary)',
                  }}>
                    TOTAL
                  </span>
                  <span className="font-display" style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: 'var(--gold-base)',
                  }}>
                    {points.winnerPoints}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {isWinner && (
          <p className="animate-slide-up stagger-3" style={{
            fontSize: 13,
            color: 'var(--gold-dim)',
            textAlign: 'center',
          }}>
            Claim your 1.8 MON from your profile
          </p>
        )}

        <div className="animate-slide-up stagger-4" style={{ display: 'flex', gap: 12 }}>
          {isWinner && (
            <Link href={`/profile/${userId}`} style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.08em',
              background: 'var(--gold-base)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 6,
              textDecoration: 'none',
            }}>
              CLAIM WINNINGS
            </Link>
          )}
          <Link href="/lobby" onClick={resetGame} style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.08em',
            background: 'var(--accent)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 6,
            textDecoration: 'none',
          }}>
            PLAY AGAIN
          </Link>
          <Link href="/leaderboard" style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.08em',
            background: 'var(--surface-2)',
            color: 'var(--text-secondary)',
            padding: '12px 24px',
            borderRadius: 6,
            textDecoration: 'none',
          }}>
            LEADERBOARD
          </Link>
        </div>
      </div>
    );
  }

  // Waiting for game
  if (!gameState) {
    return (
      <div className="felt-texture" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 10,
      }}>
        <div style={{
          width: 14,
          height: 14,
          borderRight: '2px solid var(--green-bright)',
          borderBottom: '2px solid var(--green-bright)',
          borderLeft: '2px solid var(--green-bright)',
          borderTop: '2px solid transparent',
          borderRadius: '50%',
        }} className="animate-spin" />
        <span className="font-display" style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
        }}>
          STARTING...
        </span>
      </div>
    );
  }

  // Active game
  return (
    <>
      {error && (
        <div style={{
          position: 'fixed',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          background: 'var(--danger)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
        }}>
          {error}
        </div>
      )}
      <Board
        gameState={gameState}
        userId={userId}
        walletAddress={walletAddress}
        balance={monBalance}
        onPlayCard={playCard}
        onDraw={drawCard}
        onDeclareLastCard={declareLastCard}
        onLeave={handleLeave}
        onForfeit={forfeit}
        lastAgentThinkMs={lastAgentThinkMs}
        log={log}
      />
    </>
  );
}

function FundingScreen({
  humanDeposited,
  agentDeposited,
  depositing,
  refunding,
  refundable,
  error,
  onDeposit,
  onRefund,
}: {
  humanDeposited: boolean;
  agentDeposited: boolean;
  depositing: boolean;
  refunding: boolean;
  refundable: boolean;
  error: string | null;
  onDeposit: () => void | Promise<void>;
  onRefund: () => void | Promise<void>;
}) {
  return (
    <div className="felt-texture" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--surface-1)',
        borderRadius: 10,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        <h1 className="font-display" style={{
          fontSize: 28,
          fontWeight: 900,
          color: 'var(--text-primary)',
          lineHeight: 0.95,
        }}>
          FUND MATCH
        </h1>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Both sides must deposit <strong>1 MON</strong> into the tournament pool before the game starts.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FundingRow label="Your deposit" ready={humanDeposited} />
          <FundingRow label="Opponent deposit" ready={agentDeposited} />
        </div>

        {error && (
          <div style={{
            background: 'oklch(0.30 0.08 25)',
            border: '1px solid var(--danger)',
            color: 'oklch(0.85 0.06 25)',
            padding: '10px 12px',
            borderRadius: 6,
            fontSize: 12,
          }}>
            {error}
          </div>
        )}

        {!humanDeposited && (
          <button
            onClick={onDeposit}
            disabled={depositing}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.08em',
              background: 'var(--gold-base)',
              color: '#fff',
              padding: '14px 18px',
              borderRadius: 6,
              border: 'none',
              cursor: depositing ? 'wait' : 'pointer',
              opacity: depositing ? 0.7 : 1,
            }}
          >
            {depositing ? 'DEPOSITING...' : 'DEPOSIT 1 MON'}
          </button>
        )}

        {refundable && (
          <button
            onClick={onRefund}
            disabled={refunding}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '0.08em',
              background: 'var(--surface-3)',
              color: 'var(--text-primary)',
              padding: '12px 18px',
              borderRadius: 6,
              border: 'none',
              cursor: refunding ? 'wait' : 'pointer',
              opacity: refunding ? 0.7 : 1,
            }}
          >
            {refunding ? 'REFUNDING...' : 'REFUND MATCH'}
          </button>
        )}

        {humanDeposited && !agentDeposited && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Waiting for the opponent side to fund escrow.
          </p>
        )}
      </div>
    </div>
  );
}

function FundingRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      background: 'var(--surface-2)',
      borderRadius: 6,
    }}>
      <span className="font-display" style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: 'var(--text-primary)',
      }}>
        {label}
      </span>
      <span className="font-display" style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: ready ? 'var(--green-bright)' : 'var(--text-muted)',
      }}>
        {ready ? 'FUNDED' : 'PENDING'}
      </span>
    </div>
  );
}

function PointRow({
  label,
  value,
  color,
  prefix,
}: {
  label: string;
  value: number | string;
  color?: string;
  prefix?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    }}>
      <span className="font-display" style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.1em',
        color: 'var(--text-muted)',
      }}>
        {label}
      </span>
      <span className="font-display" style={{
        fontSize: 18,
        fontWeight: 800,
        color: color ?? 'var(--text-primary)',
      }}>
        {prefix}{value}
      </span>
    </div>
  );
}

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev          # Next.js dev server (port 3000)
pnpm build        # Production build
pnpm test         # Run all vitest tests
pnpm lint         # ESLint
npx vitest run lib/game-engine/__tests__/rules.test.ts  # Single test file
```

**Database (Drizzle ORM):**
```bash
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit push        # Push schema directly to DB (dev)
npx drizzle-kit migrate     # Run migrations
```

Requires Node 22.x. Package manager is pnpm.

## Environment Variables

- `DB_URL` (or `DATABASE_URL`) — PostgreSQL connection string
- `OPENAI_API_KEY` — Required for AI agent (Gojo) to play
- `OPENAI_AGENT_MODEL` — Optional, defaults to `gpt-5.4-mini`
- `DRAND_URL` — Optional, defaults to `https://api.drand.sh`

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + Drizzle ORM (PostgreSQL) + Tailwind CSS 4 + OpenAI via Vercel AI SDK.

**Important:** Next.js 16 has breaking changes from training data. Read guides in `node_modules/next/dist/docs/` before writing Next.js code.

### Game Engine (`lib/game-engine/`)

Pure, immutable, side-effect-free game logic. Every `applyTurn()` returns a new state object — never mutates. This is the testable core:

- `state.ts` — `initializeGame()`, `applyTurn()`, `getPlayerView()` (sanitized view hiding opponent hand)
- `rules.ts` — `isValidPlay()`, `getPlayableCards()`, `mustDraw()`
- `effects.ts` — Special card effects (Hold On, Pick Two, Suspension, General Market, Whot wild)
- `cards.ts` — Deck creation (54 cards: 5 suits × 12 numbers + 5 Whot wilds), card values
- `shuffle.ts` — Deterministic Fisher-Yates with Drand seed for reproducibility
- `points.ts` — `calculateMatchPoints()`: base 100 win/10 loss + dominance bonus (loser hand value, cap 60) + speed bonus (cap 40) + streak multiplier

### Game Flow (End-to-End)

1. **Matchmaking** — Player joins queue via `POST /api/game/queue`. `tryMatch()` pairs 2 queued players. If solo, auto-creates an `agent-*` opponent.
2. **Match creation** — Drand-seeded shuffle → `initializeGame()` → persisted to `matches.gameState` (JSONB).
3. **Gameplay** — `POST /api/game/action` → `applyTurn()` → persist. Client polls `GET /api/game/state` which triggers agent turns lazily.
4. **Agent turns** — When `getGameState()` detects it's an agent's turn, `tickAgentTurn()` calls OpenAI inline, applies the move, and returns the updated state to the human player. Agents don't run in background.
5. **Finish** — `finalizeGame()` calculates points, updates seasonal leaderboard, persists results.

### Key Data Flow Pattern

All match mutations go through `withMatchLock()` which uses `pg_advisory_xact_lock(hashtext(matchId))` to serialize concurrent access to the same match. The `matches.gameState` JSONB column is the source of truth.

### Game Store (`lib/game/store.ts`)

Orchestration layer connecting game engine to database. Handles matchmaking queue, game state persistence, agent ticking, points calculation, and season updates. All public functions (`playCard`, `drawCard`, `declareLastCard`, `forfeitGame`) go through `withMatchLock`.

### AI Agent (`lib/ai/`)

- `agent.ts` — Calls OpenAI `generateObject()` with Zod schema validation. 4s timeout. Falls back to "draw" on failure.
- `strategy.ts` — System prompt (Whot rules + strategy tips) and user prompt (serialized game state).
- `logger.ts` — Logs to `logs/agent.log` for debugging agent behavior.

### Auth

Simple token-based auth. API routes use `verifyRequest()` which extracts bearer token from `Authorization` header. The proxy middleware (`proxy.ts`) forwards tokens via `x-privy-token` header.

### Seasons (`lib/seasons/manager.ts`)

Weekly seasons auto-created on demand. `getCurrentSeason()` creates one if none active. `updateSeasonPoints()` updates leaderboard atomically. Badges awarded at season rotation.

### Database Schema (`lib/db/schema.ts`)

Tables: `users`, `matchmakingQueue`, `matches`, `seasons`, `seasonPoints`, `badges`. Match state stored as JSONB. Connection pooling configured in `lib/db/index.ts` with dev-mode singleton pattern to survive HMR.

## Design Context

### Users
Young Nigerian gamers (18-30), mobile-first, competitive. The app should feel like a high-stakes game night with friends — fast, loud, confident.

### Aesthetic
Dark theme always. Green & gold palette. Bold typography. Street-smart casino energy — not generic, not corporate. References: PokerStars/WSOP intensity with African cultural confidence.

### Design Principles
1. **Culture first** — Nigerian, not generic
2. **Stakes are real** — Sharp contrasts, dramatic type, tension
3. **Speed over decoration** — Interface serves the game
4. **Card table gravity** — Dark, focused, eyes on the cards
5. **Win culture** — Winning feels massive, losing stings

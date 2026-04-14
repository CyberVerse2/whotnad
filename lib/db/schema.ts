import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
import type { GameState } from '@/types/game';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  privyId: text('privy_id').notNull().unique(),
  walletAddress: text('wallet_address'),
  displayName: text('display_name'),
  isAgent: boolean('is_agent').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const matchmakingQueue = pgTable('matchmaking_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  privyUserId: text('privy_user_id').notNull().unique(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameMatchId: text('game_match_id').unique(),
  player1Id: text('player1_id').notNull(),
  player2Id: text('player2_id').notNull(),
  winnerId: text('winner_id'),
  status: text('match_status', { enum: ['active', 'finished'] })
    .notNull()
    .default('active'),
  entryFee: numeric('entry_fee', { precision: 20, scale: 0 }),
  payout: numeric('payout', { precision: 20, scale: 0 }),
  rake: numeric('rake', { precision: 20, scale: 0 }),
  deckHash: text('deck_hash'),
  drandSeed: text('drand_seed'),
  monadTxHash: text('monad_tx_hash'),
  contractMatchId: text('contract_match_id'),
  resultTxHash: text('result_tx_hash'),
  finalStateHash: text('final_state_hash'),
  gameState: jsonb('game_state').$type<GameState>(),
  claimed: boolean('claimed').notNull().default(false),
  turnsTaken: integer('turns_taken'),
  lastAgentThought: text('last_agent_thought'),
  lastAgentThinkMs: integer('last_agent_think_ms'),
  loserPenaltyScore: integer('loser_penalty_score'),
  winnerPoints: integer('winner_points'),
  loserPoints: integer('loser_points'),
  seasonId: uuid('season_id').references(() => seasons.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const seasons = pgTable('seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: text('status', { enum: ['active', 'completed', 'upcoming'] })
    .notNull()
    .default('upcoming'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const seasonPoints = pgTable(
  'season_points',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    totalPoints: integer('total_points').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    maxStreak: integer('max_streak').notNull().default(0),
  },
  (table) => [
    uniqueIndex('season_user_idx').on(table.seasonId, table.userId),
  ]
);

export const badges = pgTable('badges', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  seasonId: uuid('season_id')
    .notNull()
    .references(() => seasons.id),
  badgeType: text('badge_type', {
    enum: [
      'champion',
      'speedster',
      'ruthless',
      'unstoppable',
      'agent_slayer',
      'veteran',
    ],
  }).notNull(),
  awardedAt: timestamp('awarded_at').defaultNow().notNull(),
});

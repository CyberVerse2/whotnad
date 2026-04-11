import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const isDevServer =
  typeof globalThis !== 'undefined' &&
  (globalThis as Record<string, unknown>).__db_client__;

const client =
  (isDevServer as ReturnType<typeof postgres> | undefined) ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
    max_lifetime: 60 * 5,
  });

if (process.env.NODE_ENV !== 'production') {
  (globalThis as Record<string, unknown>).__db_client__ = client;
}
export const db = drizzle(client, { schema });

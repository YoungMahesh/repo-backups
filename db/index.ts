import { drizzle } from 'drizzle-orm/node-postgres';

export const db = drizzle(
  process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost:5432/dummy'
);

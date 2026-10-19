import { getDb } from '../src/db'

// The same pooled connection the app under test uses (DATABASE_URL points at the test database,
// see vitest.config.ts). The reference tables are seeded once in tests/global-setup.ts.
export const db = getDb()

export * from '../src/db'

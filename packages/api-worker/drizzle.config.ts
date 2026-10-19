import type { Config } from 'drizzle-kit'

// `db:generate` reads the schema files and emits PostgreSQL migrations offline; `db:studio` and
// `db:drop` connect to DATABASE_URL.
export default {
    schema: './src/db/schema/*',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: { url: process.env.DATABASE_URL ?? '' },
    casing: 'snake_case',
} satisfies Config

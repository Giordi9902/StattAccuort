import { defineConfig } from 'vitest/config'

// Tests run in Node against the `stattaccuort_test` database of the local Postgres
// (`bun run db:up`). tests/global-setup.ts rebuilds and seeds it once per run.
export const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/stattaccuort_test'

export default defineConfig({
    resolve: {
        alias: {
            '@stattaccuort/cities': new URL('../cities/src/index.ts', import.meta.url).pathname,
        },
    },
    test: {
        globalSetup: ['./tests/global-setup.ts'],
        setupFiles: ['./tests/setup.ts'],
        env: {
            DATABASE_URL: TEST_DATABASE_URL,
            CORS_ORIGINS: 'http://localhost,http://localhost:1871,http://127.0.0.1:1871,capacitor://localhost',
            NODE_ENV: 'development',
            LOG_LEVEL: 'error',
            REPORT_HASH_SECRET: 'test-secret',
        },
        // Every suite shares the one seeded database, and several clear the reports table, so files
        // run one after another.
        fileParallelism: false,
        hookTimeout: 120_000,
    },
})

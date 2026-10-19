import { logger } from '../common/logger'

import { getDb } from './index'
import { applyMigrations } from './migrate'

//   bun run db:migrate   → applies pending migrations to DATABASE_URL
applyMigrations(getDb())
    .then(() => {
        logger.info('Migrations applied')
        process.exit(0)
    })
    .catch((error: unknown) => {
        logger.error(error, 'Migration failed')
        process.exit(1)
    })

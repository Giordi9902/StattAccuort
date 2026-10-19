import { afterEach } from 'vitest'

import { setSnapshotLoader } from '../src/db/seed/seed'
import { fsSnapshotLoader } from '../src/db/seed/snapshots'
import { clearReferenceCache } from '../src/modules/transit/reference-cache'

// Suites that re-run the seed read the same bundled snapshots global-setup seeded from.
setSnapshotLoader(fsSnapshotLoader)

// The in-process reference cache would otherwise carry one suite's view of the network into the next.
afterEach(() => {
    clearReferenceCache()
})

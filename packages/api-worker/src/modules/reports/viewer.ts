import type { Context } from 'hono'

import type { Env } from '../../app-env'
import { requestFingerprint } from '../report-intake'

import type { ViewerContext } from './reports-service'

/*
 * Builds the read-side view of who is asking: the trust a station needs before its reports are
 * shown, plus the requester's own fingerprint so that its own reports are shown to it regardless.
 * Intake stores every report with trust 1, so no threshold applies yet; the hooks stay so one can
 * be introduced without touching the read path.
 */
export const resolveViewer = (c: Context<Env>): ViewerContext => ({
    minStationTrust: 0,
    clientHash: requestFingerprint(c),
    onSuppressed: () => c.set('reportsUncacheable', true),
})

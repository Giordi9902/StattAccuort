import { createHmac } from 'node:crypto'

import { getConnInfo } from '@hono/node-server/conninfo'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import type { Context } from 'hono'

import type { Env } from '../../app-env'
import { AppError } from '../../common/errors'
import { reportsSubmitted } from '../../common/metrics'
import { type DbConnection, reports } from '../../db'

/*
 * Report intake: stores public reports and rate limits them per device. A device is an anonymous
 * fingerprint — an HMAC of the client IP and User-Agent under a server secret — so the database
 * never holds either value, and the fingerprint can't be reversed or matched across deployments.
 */

// The unchanged frontend still attaches this header when a Turnstile site key is configured. It
// must stay in the CORS allow-list or the browser fails the preflight and never sends the report.
export const TURNSTILE_TOKEN_HEADER = 'cf-turnstile-response'

export type NormalizedReport = {
    stationId: string
    lineId: string | null
    directionId: string | null
    source: 'mini_app' | 'web_app' | 'mobile_app'
}

export type CreatedReport = {
    reportId: number
    stationId: string
    lineId: string | null
    directionId: string | null
    timestamp: string
}

const FINGERPRINT_LENGTH = 32

export const clientFingerprint = (secret: string, ip: string, userAgent: string): string =>
    createHmac('sha256', secret).update(`${ip}\n${userAgent}`).digest('hex').slice(0, FINGERPRINT_LENGTH)

/** The client IP: the first X-Forwarded-For hop behind a trusted proxy, else the socket peer. */
export const clientIp = (c: Context<Env>): string => {
    if (c.get('config').trustProxy) {
        const forwarded = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
        if (forwarded !== undefined && forwarded !== '') return forwarded
    }
    try {
        return getConnInfo(c).remote.address ?? ''
    } catch {
        // No socket behind the request: app.request() in tests.
        return ''
    }
}

export const requestFingerprint = (c: Context<Env>): string =>
    clientFingerprint(c.get('config').reportHashSecret, clientIp(c), c.req.header('User-Agent') ?? '')

export const rateLimited = (cooldownSeconds: number) =>
    new AppError({
        message: 'Too many reports from this device',
        statusCode: 429,
        internalCode: 'REPORT_RATE_LIMITED',
        description: `One report every ${cooldownSeconds} seconds`,
    })

/**
 * Store a report unless the same device reported within the cooldown. The check and the insert run
 * in one transaction under an advisory lock on the fingerprint, so two simultaneous submissions from
 * one device can't both pass the check.
 */
export const intakeReport = (
    db: DbConnection,
    report: NormalizedReport,
    { clientHash, cooldownSeconds, now = new Date() }: { clientHash: string; cooldownSeconds: number; now?: Date }
): Promise<CreatedReport> =>
    db
        .transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clientHash}))`)

            if (cooldownSeconds > 0) {
                const since = new Date(now.getTime() - cooldownSeconds * 1000)
                const [recent] = await tx
                    .select({ reportId: reports.reportId })
                    .from(reports)
                    .where(and(eq(reports.clientHash, clientHash), gte(reports.timestamp, since)))
                    .orderBy(desc(reports.timestamp))
                    .limit(1)
                if (recent !== undefined) {
                    reportsSubmitted.inc({ kind: 'inspection', outcome: 'rate_limited' })
                    throw rateLimited(cooldownSeconds)
                }
            }

            const [created] = await tx
                .insert(reports)
                .values({ ...report, timestamp: now, clientHash, trust: 1 })
                .returning({
                    reportId: reports.reportId,
                    stationId: reports.stationId,
                    lineId: reports.lineId,
                    directionId: reports.directionId,
                    timestamp: reports.timestamp,
                })
            return { ...created, timestamp: created.timestamp.toISOString() }
        })
        .then((created) => {
            reportsSubmitted.inc({ kind: 'inspection', outcome: 'created' })
            return created
        })

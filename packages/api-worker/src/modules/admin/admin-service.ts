import { and, count, countDistinct, desc, eq, gte, isNotNull, lt, max, min, sql } from 'drizzle-orm'
import { DateTime } from 'luxon'

import { processSnapshot } from '../../common/metrics'
import {
    type DbConnection,
    eavStationBoards,
    incidents,
    lines,
    reports,
    segments,
    stations,
    timetableServiceDates,
} from '../../db'

import type { AdminOverview, AdminWindow } from './admin-contract'

const MINUTE_MS = 60_000
const TOP_LIMIT = 10
const DEVICE_PREFIX_LENGTH = 8

const WINDOWS: Record<AdminWindow, { hours: number; bucketMinutes: number }> = {
    '1h': { hours: 1, bucketMinutes: 5 },
    '24h': { hours: 24, bucketMinutes: 60 },
    '7d': { hours: 168, bucketMinutes: 360 },
    '30d': { hours: 720, bucketMinutes: 1440 },
}

/*
 * Buckets are aligned to the city's local midnight, so a 30-day chart has one bar per local day and
 * a 7-day one splits days at 00/06/12/18 local time. The last bucket is the current, partial one.
 */
export const overviewWindow = (name: AdminWindow, timezone: string, now: Date) => {
    const { hours, bucketMinutes } = WINDOWS[name]
    const bucketMs = bucketMinutes * MINUTE_MS
    const bucketCount = (hours * 60) / bucketMinutes
    const origin = DateTime.fromJSDate(now).setZone(timezone).startOf('day').toMillis()
    const currentBucket = origin + Math.floor((now.getTime() - origin) / bucketMs) * bucketMs
    const start = currentBucket - (bucketCount - 1) * bucketMs
    return { name, bucketMinutes, bucketMs, bucketCount, start: new Date(start), end: now }
}

const ranked = (rows: { id: string | null; name: string | null; count: number }[]) =>
    rows.map(({ id, name, count: value }) => ({ id: id ?? '', name: name ?? id ?? '', count: value }))

const loadReports = async (db: DbConnection, window: ReturnType<typeof overviewWindow>) => {
    const inWindow = gte(reports.timestamp, window.start)
    const bucket = sql<number>`floor((extract(epoch from ${reports.timestamp}) * 1000 - ${window.start.getTime()}) / ${window.bucketMs})::int`
    const previousStart = new Date(window.start.getTime() - (window.end.getTime() - window.start.getTime()))

    const [totals, previous, bySource, buckets, topStations, topLines, topDevices, latest] = await Promise.all([
        db
            .select({ total: count(), devices: countDistinct(reports.clientHash) })
            .from(reports)
            .where(inWindow),
        db
            .select({ total: count() })
            .from(reports)
            .where(and(gte(reports.timestamp, previousStart), lt(reports.timestamp, window.start))),
        db
            .select({ source: reports.source, count: count() })
            .from(reports)
            .where(inWindow)
            .groupBy(reports.source)
            .orderBy(desc(count())),
        // By position: the bound parameters make a repeated expression differ from the selected one.
        db
            .select({ bucket, count: count() })
            .from(reports)
            .where(inWindow)
            .groupBy(sql`1`),
        db
            .select({ id: reports.stationId, name: stations.name, count: count() })
            .from(reports)
            .leftJoin(stations, eq(stations.id, reports.stationId))
            .where(inWindow)
            .groupBy(reports.stationId, stations.name)
            .orderBy(desc(count()))
            .limit(TOP_LIMIT),
        db
            .select({ id: reports.lineId, name: lines.name, count: count() })
            .from(reports)
            .leftJoin(lines, eq(lines.id, reports.lineId))
            .where(and(inWindow, isNotNull(reports.lineId)))
            .groupBy(reports.lineId, lines.name)
            .orderBy(desc(count()))
            .limit(TOP_LIMIT),
        db
            .select({ hash: reports.clientHash, count: count(), stations: countDistinct(reports.stationId) })
            .from(reports)
            .where(and(inWindow, isNotNull(reports.clientHash)))
            .groupBy(reports.clientHash)
            .orderBy(desc(count()))
            .limit(TOP_LIMIT),
        db.select({ at: max(reports.timestamp) }).from(reports),
    ])

    const counts = new Map(buckets.map((row) => [row.bucket, row.count]))
    return {
        total: totals[0]?.total ?? 0,
        previousTotal: previous[0]?.total ?? 0,
        devices: totals[0]?.devices ?? 0,
        bySource,
        series: Array.from({ length: window.bucketCount }, (_, index) => ({
            start: new Date(window.start.getTime() + index * window.bucketMs).toISOString(),
            count: counts.get(index) ?? 0,
        })),
        topStations: ranked(topStations),
        topLines: ranked(topLines),
        topDevices: topDevices.map((row) => ({
            device: (row.hash ?? '').slice(0, DEVICE_PREFIX_LENGTH),
            count: row.count,
            stations: row.stations,
        })),
        lastReportAt: latest[0]?.at?.toISOString() ?? null,
    }
}

// GTFS service dates are stored as YYYYMMDD integers.
const isoDate = (value: number | null | undefined): string | null =>
    value === null || value === undefined ? null : String(value).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')

const loadData = async (db: DbConnection) => {
    const [stationCount, lineCount, segmentCount, boardCount, serviceDates] = await Promise.all([
        db.select({ value: count() }).from(stations),
        db.select({ value: count() }).from(lines),
        db.select({ value: count() }).from(segments),
        db.select({ value: count() }).from(eavStationBoards),
        db
            .select({ first: min(timetableServiceDates.date), last: max(timetableServiceDates.date) })
            .from(timetableServiceDates),
    ])
    return {
        stations: stationCount[0]?.value ?? 0,
        lines: lineCount[0]?.value ?? 0,
        segments: segmentCount[0]?.value ?? 0,
        eavBoards: boardCount[0]?.value ?? 0,
        timetableFirstDate: isoDate(serviceDates[0]?.first),
        timetableLastDate: isoDate(serviceDates[0]?.last),
    }
}

const loadDatabase = async (db: DbConnection) => {
    const rows = await db.execute<{
        version: string
        size_bytes: string
        connections: string
        max_connections: string
    }>(sql`
        select current_setting('server_version') as version,
               pg_database_size(current_database()) as size_bytes,
               (select count(*) from pg_stat_activity where datname = current_database()) as connections,
               current_setting('max_connections') as max_connections
    `)
    const row = rows[0]
    return {
        version: row?.version ?? '',
        sizeBytes: Number(row?.size_bytes ?? 0),
        connections: Number(row?.connections ?? 0),
        maxConnections: Number(row?.max_connections ?? 0),
    }
}

export const getOverview = async (
    db: DbConnection,
    { window: windowName, timezone, now = new Date() }: { window: AdminWindow; timezone: string; now?: Date }
): Promise<AdminOverview> => {
    const window = overviewWindow(windowName, timezone, now)
    const [reportStats, incidentCounts, data, database, instance] = await Promise.all([
        loadReports(db, window),
        db
            .select({ kind: incidents.kind, count: count() })
            .from(incidents)
            .where(gte(incidents.timestamp, window.start))
            .groupBy(incidents.kind)
            .orderBy(desc(count())),
        loadData(db),
        loadDatabase(db),
        processSnapshot(),
    ])
    return {
        generatedAt: now.toISOString(),
        window: {
            name: window.name,
            start: window.start.toISOString(),
            end: window.end.toISOString(),
            bucketMinutes: window.bucketMinutes,
        },
        reports: reportStats,
        incidents: incidentCounts,
        data,
        database,
        instance,
    }
}

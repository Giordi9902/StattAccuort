import { execFileSync } from 'node:child_process'
import { createReadStream, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { parseCsvLine } from './csv'

/*
 * GTFS feed access shared by the seed refresh (bus network) and the timetable import (departures).
 * Node APIs only, so it runs under both tsx and bun.
 */

/**
 * Stream a CSV file row by row as header-keyed records. Streaming matters for stop_times.txt,
 * which runs to tens of megabytes. A missing column reads as ''.
 */
export const readCsv = async (path: string, onRow: (row: Record<string, string>) => void): Promise<void> => {
    const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
    let header: string[] | undefined
    for await (const rawLine of lines) {
        if (rawLine === '') continue
        if (header === undefined) {
            // Strip the UTF-8 BOM some feeds start with, or the first column name never matches.
            header = parseCsvLine(rawLine.replace(/^\uFEFF/, ''))
            continue
        }
        const values = parseCsvLine(rawLine)
        const row: Record<string, string> = {}
        header.forEach((column, index) => {
            row[column] = values[index] ?? ''
        })
        onRow(row)
    }
}

export interface GtfsFeed {
    /** Absolute path of one of the feed's files, e.g. `file('stops.txt')`. */
    file: (name: string) => string
    has: (name: string) => boolean
}

/**
 * Download and unpack a GTFS zip into a temporary directory, hand it to `use`, and delete the
 * directory afterwards — the unpacked feed is ~60 MB, and every run would otherwise leave one behind.
 */
export const withGtfsFeed = async <T>(url: string, use: (feed: GtfsFeed) => Promise<T>): Promise<T> => {
    const dir = mkdtempSync(join(tmpdir(), 'stattaccuort-gtfs-'))
    try {
        const zipPath = join(dir, 'feed.zip')
        console.log(`[gtfs] Downloading ${url}...`)
        const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
        if (!response.ok) throw new Error(`GET ${url} returned ${response.status}`)
        writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()))
        execFileSync('unzip', ['-q', '-o', zipPath, '-d', dir])
        const file = (name: string) => join(dir, name)
        return await use({ file, has: (name) => existsSync(file(name)) })
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}

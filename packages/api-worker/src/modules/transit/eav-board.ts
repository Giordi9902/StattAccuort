/*
 * EAV's live departure boards (orariotreni.eavsrl.it "teleindicatori"). There is no documented API:
 * the board page posts to `ws_getData_moova.php` and gets back an HTML table, one <tr> per train
 * with cells classed numTreno / categoria / destinazione / informazioni / binario / orario /
 * ritardo. Parsing keys on those class names, so a change to that markup shows up as an empty
 * board rather than as wrong data.
 */

export interface EavBoardRow {
    train: string
    destination: string
    /** Scheduled departure, `HH:MM` city-local. */
    time: string
    /** Minutes late, or null when the board shows none. */
    delayMinutes: number | null
    platform: string | null
    /** Intermediate stops from the "Ferma a: …" note; empty when the board lists none. */
    stops: string[]
}

export const EAV_BOARD_PATH = 'teleindicatori/ws_getData_moova.php'

const decodeEntities = (text: string): string =>
    text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')

const cellText = (row: string, className: string): string => {
    const match = new RegExp(`<td[^>]*class="${className}"[^>]*>([\\s\\S]*?)</td>`).exec(row)
    if (!match) return ''
    return decodeEntities(match[1].replace(/<[^>]*>/g, ''))
        .replace(/\s+/g, ' ')
        .trim()
}

// "Ferma a: TORRE A.TA - OPLONTI (10:18), Villa Regina (10:21)" → ["TORRE A.TA - OPLONTI", "Villa Regina"]
const parseStops = (information: string): string[] => {
    const match = /Ferma a:\s*(.*)$/i.exec(information)
    if (!match) return []
    return match[1]
        .split(/\),\s*/)
        .map((stop) => stop.replace(/\s*\(\d{1,2}:\d{2}\)?\s*$/, '').trim())
        .filter((stop) => stop !== '')
}

export const parseEavBoard = (html: string): EavBoardRow[] => {
    const rows: EavBoardRow[] = []
    for (const [row] of html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)) {
        const time = cellText(row, 'orario')
        // Header and title rows carry no orario cell.
        if (!/^\d{1,2}:\d{2}$/.test(time)) continue
        const delay = Number.parseInt(cellText(row, 'ritardo'), 10)
        const platform = cellText(row, 'binario')
        rows.push({
            train: cellText(row, 'numTreno'),
            destination: cellText(row, 'destinazione'),
            time,
            delayMinutes: Number.isFinite(delay) && delay > 0 ? delay : null,
            platform: platform === '' ? null : platform,
            stops: parseStops(cellText(row, 'informazioni')),
        })
    }
    return rows
}

/*
 * Station names differ in spelling between OSM, the GTFS feed and EAV ("NAPOLI P. GARIBALDI" vs
 * "Napoli Piazza Garibaldi", "S. Giorgio a Cremano" vs "San Giorgio a Cremano"). Reduce a name to
 * lowercase ASCII words with the common abbreviations expanded so they compare equal.
 */
const ABBREVIATIONS: [RegExp, string][] = [
    [/\bp\.?\s?zza\b\.?/g, 'piazza'],
    [/\bp\.\s?/g, 'piazza '],
    [/\bs\.\s?/g, 'san '],
    [/\bss\.\s?/g, 'santi '],
    [/\bv\.\s?le\b/g, 'viale'],
    [/\bc\.\s?so\b/g, 'corso'],
    [/\ba\.\s?ta\b/g, 'annunziata'],
    [/\bstaz\.?(?=\s|$)/g, 'stazione'],
]

export const normalizeStationName = (name: string): string => {
    let text = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    for (const [pattern, replacement] of ABBREVIATIONS) text = text.replace(pattern, replacement)
    return text
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(santa|sant)\b/g, 'san')
        .trim()
}

/**
 * Two station names match when one's normalized words appear, in order, inside the other's
 * ("porta nolana" in "napoli porta nolana"). Whole words only, so "meta" never matches "metamorfosi".
 */
export const stationNamesEquivalent = (a: string, b: string): boolean => {
    const na = ` ${normalizeStationName(a)} `
    const nb = ` ${normalizeStationName(b)} `
    return na.trim() !== '' && nb.trim() !== '' && (na.includes(nb) || nb.includes(na))
}

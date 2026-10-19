import { normalizeStationName, stationNamesEquivalent } from '../../modules/transit/eav-board'

/*
 * Matching EAV's departure boards to seeded stations. The board site's home page embeds the full
 * board list as JSON in `<script id="data-localita">`; each entry names a station on one EAV line
 * and carries the two ids the board endpoint takes.
 */

export interface EavLocalita {
    descrizione: string
    idLinea: string
    codLoc: string
    touchpoint: string
}

export const extractEavLocalita = (html: string): EavLocalita[] => {
    const match = /<script id="data-localita" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
    if (!match) throw new Error('EAV board list not found — the data-localita script is missing from the page')
    const entries = JSON.parse(match[1]) as Record<string, string | undefined>[]
    const result: EavLocalita[] = []
    for (const entry of entries) {
        const { descrizione, idLinea, idLocMoova, touchpoint, visualizzato } = entry
        // The site hides some entries itself (visualizzato=false); they have no usable board.
        if (visualizzato !== 'true') continue
        if (descrizione === undefined || idLocMoova === undefined || touchpoint === undefined) continue
        if (descrizione === '' || idLocMoova === '' || touchpoint === '') continue
        result.push({ descrizione, idLinea: idLinea ?? '', codLoc: idLocMoova, touchpoint })
    }
    return result
}

export interface CandidateStation {
    id: string
    name: string
}

/**
 * The seeded station a board belongs to, among the stations of the EAV lines: an exact match on
 * the normalized name first, else the containment match whose length is closest ("NAPOLI PORTA
 * NOLANA" → "Porta Nolana"). `aliases` maps a board name to the seeded station name for the cases
 * spelling can't bridge.
 */
export const matchEavStation = (
    descrizione: string,
    candidates: readonly CandidateStation[],
    aliases: Readonly<Record<string, string>> = {}
): string | undefined => {
    const wanted = aliases[descrizione] ?? descrizione
    const normalized = normalizeStationName(wanted)
    const exact = candidates.find((station) => normalizeStationName(station.name) === normalized)
    if (exact) return exact.id

    let best: CandidateStation | undefined
    let bestGap = Infinity
    for (const station of candidates) {
        if (!stationNamesEquivalent(station.name, wanted)) continue
        const gap = Math.abs(normalizeStationName(station.name).length - normalized.length)
        if (gap < bestGap) {
            best = station
            bestGap = gap
        }
    }
    return best?.id
}

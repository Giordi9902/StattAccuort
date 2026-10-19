/**
 * Split one CSV line (RFC 4180 quoting: `"a,b"` is one field, `""` is an escaped quote).
 * GTFS files never put a line break inside a field, so line-at-a-time parsing is enough.
 */
export const parseCsvLine = (line: string): string[] => {
    const fields: string[] = []
    let field = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') {
                field += '"'
                i++
            } else if (ch === '"') {
                quoted = false
            } else {
                field += ch
            }
        } else if (ch === '"') {
            quoted = true
        } else if (ch === ',') {
            fields.push(field)
            field = ''
        } else {
            field += ch
        }
    }
    fields.push(field)
    return fields
}

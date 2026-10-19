// Postgres caps a statement at 65 535 bound parameters, so every bulk write is split into chunks
// that stay well under it. Smaller chunks also keep a single failed batch cheap to diagnose.
const MAX_BOUND_PARAMS = 30_000

const chunk = <T>(items: readonly T[], size: number): T[][] => {
    const chunks: T[][] = []
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size))
    }
    return chunks
}

// Split rows for a multi-row insert so `rows * columnsPerRow` stays under the parameter limit.
export const chunkRowsForInsert = <T>(rows: readonly T[], columnsPerRow: number): T[][] => {
    const rowsPerChunk = Math.max(1, Math.floor(MAX_BOUND_PARAMS / Math.max(1, columnsPerRow)))
    return chunk(rows, rowsPerChunk)
}

// Split a list of values bound into a single predicate (e.g. inArray) into safe-sized batches.
export const chunkValues = <T>(values: readonly T[]): T[][] => chunk(values, MAX_BOUND_PARAMS)

import { DEFAULT_CITY_SLUG, getCity } from '@stattaccuort/cities'

/**
 * Parse `--city <slug>` from the seed CLI args, defaulting to the registry's default city, and validate
 * it against the registry so a typo fails before any fetching or DB writes. Kept
 * free of ./config so the caller can set SEED_CITY from the result before the
 * registry-backed seed config is evaluated.
 */
export const parseCityArg = (argv: string[] = process.argv): string => {
    const flag = argv.indexOf('--city')
    const slug = flag !== -1 ? argv[flag + 1] : DEFAULT_CITY_SLUG

    if (!slug) {
        throw new Error('--city requires a value, e.g. --city napoli')
    }
    if (!getCity(slug)) {
        throw new Error(`Unknown city "${slug}" — not in the @stattaccuort/cities registry`)
    }
    return slug
}

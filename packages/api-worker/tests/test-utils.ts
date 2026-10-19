import { vi } from 'vitest'

import type { Bindings } from '../src/app-env'
import { app } from '../src/index'

const overrides: Partial<Bindings> = {}

export const setTestEnv = (values: Partial<Bindings>) => {
    Object.assign(overrides, values)
}

export const resetTestEnv = () => {
    for (const key of Object.keys(overrides)) delete overrides[key as keyof Bindings]
}

export const testEnv = (): Bindings => ({
    DATABASE_URL: process.env.DATABASE_URL,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL as Bindings['LOG_LEVEL'],
    REPORT_HASH_SECRET: process.env.REPORT_HASH_SECRET,
    // No cooldown unless a test asks for one: most suites post several reports in a row.
    REPORT_COOLDOWN_SECONDS: '0',
    // Requests built by app.request() have no socket, so tests identify clients by X-Forwarded-For.
    TRUST_PROXY: 'true',
    ...overrides,
})

export const setSystemTime = (date?: Date) => {
    if (date === undefined) {
        vi.useRealTimers()
        return
    }
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(date)
}

export const appRequestWithRedirect = async (path: string, init?: RequestInit, targetApp = app) => {
    const response = await targetApp.request(path, init, testEnv())
    if (response.status === 307) {
        const location = response.headers.get('Location')
        if (location) {
            const url = new URL(location, 'http://localhost')
            return targetApp.request(url.pathname + url.search, init, testEnv())
        }
    }
    return response
}

export const sendReportRequest = async (payload: object, routeApp = app, headers: Record<string, string> = {}) =>
    appRequestWithRedirect(
        '/reports',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(payload),
        },
        routeApp
    )

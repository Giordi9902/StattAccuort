import { afterEach, describe, expect, it } from 'vitest'

import { appRequestWithRedirect, resetTestEnv } from './test-utils'

type ConfigResponse = {
    city: {
        slug: string
        displayName: string
        lang: string
        timezone: string
        map: { center: readonly [number, number] }
    }
}

const getConfig = async (path = '/config') => {
    const response = await appRequestWithRedirect(path)
    expect(response.status).toBe(200)
    return { response, body: (await response.json()) as ConfigResponse }
}

afterEach(() => resetTestEnv())

describe('GET /v0/config', () => {
    it('returns centrally resolved city config', async () => {
        const { body } = await getConfig('/config?city=napoli')

        expect(body.city).toMatchObject({
            slug: 'napoli',
            displayName: 'Napoli',
            lang: 'it',
            timezone: 'Europe/Rome',
            map: { center: expect.any(Array) },
        })
        expect(body.city).not.toHaveProperty('community.telegramChatId')
    })

    it('is never cached', async () => {
        const { response } = await getConfig()
        expect(response.headers.get('Cache-Control')).toBe('no-store')
    })
})

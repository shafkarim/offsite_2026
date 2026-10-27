import { getPayload, Payload, type SanitizedConfig } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload
let payloadConfig: SanitizedConfig

describe('API', () => {
  beforeAll(async () => {
    payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'users',
      overrideAccess: true,
    })
    expect(users).toBeDefined()
  })

  it('uses the outer staging identity without a second OAuth flow', () => {
    const users = payloadConfig.collections.find((collection) => collection.slug === 'users')
    const strategyNames =
      users && typeof users.auth === 'object'
        ? users.auth.strategies?.map((strategy) => strategy.name)
        : []
    const beforeLogin = payloadConfig.admin.components?.beforeLogin ?? []

    expect(strategyNames).toContain('figma-staging-viewer')
    expect(strategyNames).not.toContain('users-oauth')
    expect(
      Array.isArray(users?.endpoints) &&
        users.endpoints.some((endpoint) => endpoint.path?.startsWith('/sso/')),
    ).toBe(false)
    expect(
      beforeLogin.some((component) => {
        const path =
          typeof component === 'string'
            ? component
            : component && typeof component === 'object'
              ? component.path
              : undefined
        return path === '@payloadcms/figma/client#DefaultLoginButton'
      }),
    ).toBe(false)
  })
})

import path from 'path'
import { buildFigmaConfig } from '@payloadcms/figma'
import { fileURLToPath } from 'url'
import type { SanitizedConfig } from 'payload'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Folders } from './collections/Folders'
import { Tags } from './collections/Tags'
import { PlanningCycles } from './collections/PlanningCycles'
import { Programs } from './collections/Programs'
import { Bets } from './collections/Bets'
import { ActivityPlans } from './collections/ActivityPlans'
import { Decisions } from './collections/Decisions'
import { SourceReferences } from './collections/SourceReferences'
import { AppState } from './collections/AppState'
import { GovernedSnapshots } from './collections/GovernedSnapshots'
import { ForecastSettings } from './globals/ForecastSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const stagingProjectId = '4e3f3721-aba0-4513-a33d-38c56be0a61c'
const stagingServerURL = 'https://marketing-forecast-tool-staging.pung.site'

if (process.env.FIGMA_INFRA_ENV && process.env.FIGMA_INFRA_ENV !== 'staging') {
  throw new Error('This application is staging-only. Refusing to run against non-staging Figma infrastructure.')
}

if (process.env.FIGMA_PROJECT_ID && process.env.FIGMA_PROJECT_ID !== stagingProjectId) {
  throw new Error('This application is staging-only. Refusing to use an unapproved Figma project.')
}

if (
  process.env.FIGMA_CONTENT_API_URL &&
  !process.env.FIGMA_CONTENT_API_URL.includes('figmacontentstaging.com')
) {
  throw new Error('This application is staging-only. Refusing to use a non-staging Figma content API.')
}

// Deployed tenant processes do not always receive FIGMA_INFRA_ENV. Pin the
// public API, OAuth issuer, and content API to staging before buildFigmaConfig
// resolves its authentication strategy, preventing a production-host fallback
// and the resulting login redirect loop.
process.env.FIGMA_INFRA_ENV = 'staging'
process.env.FIGMA_PROJECT_ID = stagingProjectId
process.env.FIGMA_API_BASE_URL ??= 'https://api.staging.figma.com'
process.env.FIGMA_WEB_BASE_URL ??= 'https://staging.figma.com'
process.env.FIGMA_CONTENT_API_URL ??= 'https://us-east-1.cms-tenants-001-staging.figmacontentstaging.com'

/**
 * Figma staging already protects the whole site with Okta and forwards the
 * trusted viewer identity header used by Users. buildFigmaConfig also adds an
 * inner Figma OAuth flow by default; keeping both causes the staging login
 * redirect loop. Remove only that generated inner flow after the Figma config
 * has supplied the Content API, storage, and other platform defaults.
 */
export function removeDuplicateStagingOAuth(config: SanitizedConfig): SanitizedConfig {
  const users = config.collections.find((collection) => collection.slug === Users.slug)

  if (users && typeof users.auth === 'object') {
    users.auth.strategies = users.auth.strategies?.filter(
      (strategy) => strategy.name !== `${Users.slug}-oauth`,
    )
    if (Array.isArray(users.endpoints)) {
      users.endpoints = users.endpoints.filter(
        (endpoint) => !endpoint.path?.startsWith('/sso/'),
      )
    }
  }

  const beforeLogin = config.admin.components?.beforeLogin
  if (beforeLogin) {
    config.admin.components.beforeLogin = beforeLogin.filter((component) => {
      const path =
        typeof component === 'string'
          ? component
          : component && typeof component === 'object'
            ? component.path
            : undefined
      return path !== '@payloadcms/figma/client#DefaultLoginButton'
    })
  }

  return config
}

const config = buildFigmaConfig({
  serverURL: stagingServerURL,
  cors: [stagingServerURL, 'https://staging.figma.com'],
  csrf: [stagingServerURL, 'https://staging.figma.com'],
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    PlanningCycles,
    Programs,
    Bets,
    ActivityPlans,
    Decisions,
    SourceReferences,
    GovernedSnapshots,
    AppState,
    Media,
    Folders,
    Tags,
  ],
  globals: [ForecastSettings],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  localization: {
    locales: ['en'],
    fallback: true,
    defaultLocale: 'en',
  },
  figma: {},
})

export default config.then(removeDuplicateStagingOAuth)

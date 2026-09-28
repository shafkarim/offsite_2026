import type { AuthStrategy, CollectionConfig } from 'payload'

import { adminOnly, authenticated, isAdminUser } from '../access'

const ownerEmail = 'skarim@figma.com'

/**
 * Staging Figma Cloud sits behind Okta and Gatekeeper supplies this trusted
 * identity header. Authenticating it here avoids a second Payload OAuth flow,
 * including the known legacy/partitioned-cookie redirect loop.
 */
const figmaStagingViewerStrategy: AuthStrategy = {
  name: 'figma-staging-viewer',
  authenticate: async ({ headers, payload }) => {
    const email = headers.get('figma-viewer-email-address')?.trim().toLowerCase()

    if (!email || !email.endsWith('@figma.com')) {
      return { user: null }
    }

    const findUser = async () => {
      const result = await payload.find({
        collection: 'users',
        limit: 1,
        overrideAccess: true,
        pagination: false,
        where: { email: { equals: email } },
      })

      return result.docs[0]
    }

    let user = await findUser()

    if (!user) {
      try {
        user = await payload.create({
          collection: 'users',
          overrideAccess: true,
          data: {
            email,
            displayName: email.split('@')[0],
            role: email === ownerEmail ? 'admin' : 'viewer',
          },
        })
      } catch {
        // A simultaneous first request can create the same unique user. Read the
        // winning record instead of failing authentication.
        user = await findUser()
      }
    }

    if (!user) {
      return { user: null }
    }

    return {
      user: {
        ...user,
        collection: 'users',
        _strategy: 'figma-staging-viewer',
      },
    }
  },
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  access: {
    read: authenticated,
    create: adminOnly,
    update: ({ req, id }) => req.user?.id === id || isAdminUser(req.user),
    delete: adminOnly,
  },
  auth: {
    strategies: [figmaStagingViewerStrategy],
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'viewer',
      saveToJWT: true,
      options: ['viewer', 'planner', 'approver', 'admin'],
      access: {
        update: ({ req }) => isAdminUser(req.user),
      },
    },
    {
      name: 'oktaSubject',
      type: 'text',
      unique: true,
      index: true,
      access: {
        update: ({ req }) => isAdminUser(req.user),
      },
    },
  ],
  versions: false,
}

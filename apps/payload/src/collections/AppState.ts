import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated, plannerOrAbove } from '../access'
import { enforceOptimisticConcurrency, optimisticConcurrencyField } from '../concurrency'

/**
 * Small, non-sensitive shared state used by the original Figma Make interface.
 * Approved semantic data remains outside Payload; this collection only stores
 * planning inputs, aggregate overrides, and UI configuration.
 */
export const AppState: CollectionConfig = {
  slug: 'app-state',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'updatedAt'],
  },
  access: {
    read: authenticated,
    create: plannerOrAbove,
    update: plannerOrAbove,
    delete: adminOnly,
  },
  versions: {
    maxPerDoc: 100,
  },
  hooks: {
    beforeChange: [enforceOptimisticConcurrency],
  },
  fields: [
    optimisticConcurrencyField,
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'value',
      type: 'json',
      required: true,
      admin: {
        description: 'Non-sensitive planning state only. Never store raw lead, contact, session, or opportunity data.',
      },
    },
  ],
}

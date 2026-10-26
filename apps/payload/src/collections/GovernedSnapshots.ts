import type { CollectionConfig } from 'payload'

/**
 * System-managed, aggregate-only snapshots from approved data providers.
 * Browser users cannot create, edit, delete, or query these records directly;
 * authenticated API routes expose only the validated contract required by the app.
 */
export const GovernedSnapshots: CollectionConfig = {
  slug: 'governed-snapshots',
  admin: {
    hidden: true,
    useAsTitle: 'key',
  },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  versions: {
    maxPerDoc: 25,
  },
  fields: [
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
    },
    {
      name: 'sourceGeneratedAt',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'sourceAsOf',
      type: 'date',
      required: true,
    },
    {
      name: 'contentHash',
      type: 'text',
      required: true,
      index: true,
    },
  ],
}

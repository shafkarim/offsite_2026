import type { CollectionConfig } from 'payload'

import { createFolderField, createTagField } from 'payload'

import { adminOnly, authenticated, plannerOrAbove } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: authenticated,
    create: plannerOrAbove,
    update: plannerOrAbove,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    createFolderField({ relationTo: 'folders' }),
    createTagField({ relationTo: 'tags' }),
  ],
  upload: true,
}

import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated, plannerOrAbove } from '../access'

export const Tags: CollectionConfig = {
  slug: 'tags',
  access: {
    read: authenticated,
    create: plannerOrAbove,
    update: plannerOrAbove,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'name',
  },
  tags: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}

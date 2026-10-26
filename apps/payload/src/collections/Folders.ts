import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated, plannerOrAbove } from '../access'

export const Folders: CollectionConfig = {
  slug: 'folders',
  access: {
    read: authenticated,
    create: plannerOrAbove,
    update: plannerOrAbove,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'name',
  },
  folders: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}

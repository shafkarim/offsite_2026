import type { CollectionConfig } from 'payload'

import { adminOnly, approverOrAbove, authenticated } from '../access'
import { enforceOptimisticConcurrency, optimisticConcurrencyField } from '../concurrency'

export const SourceReferences: CollectionConfig = {
  slug: 'source-references',
  admin: {
    useAsTitle: 'assetName',
    defaultColumns: ['assetName', 'sourceStatus', 'freshnessAt', 'updatedAt'],
  },
  access: {
    read: authenticated,
    create: approverOrAbove,
    update: approverOrAbove,
    delete: adminOnly,
  },
  versions: {
    maxPerDoc: 50,
  },
  hooks: {
    beforeChange: [enforceOptimisticConcurrency],
  },
  fields: [
    optimisticConcurrencyField,
    { name: 'assetName', type: 'text', required: true },
    { name: 'assetUrl', type: 'text', required: true },
    { name: 'semanticAssetId', type: 'text' },
    {
      name: 'sourceStatus',
      type: 'select',
      required: true,
      options: ['semantic-approved', 'pending-review', 'blocked'],
    },
    { name: 'freshnessAt', type: 'date' },
    { name: 'validatedAt', type: 'date' },
    { name: 'releaseStatus', type: 'text' },
    { name: 'methodologyVersion', type: 'text' },
    {
      name: 'note',
      type: 'textarea',
      admin: {
        description: 'Reference metadata only; do not paste underlying row-level data.',
      },
    },
  ],
}

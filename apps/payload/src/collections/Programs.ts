import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated, plannerOrAbove } from '../access'
import { enforceOptimisticConcurrency, optimisticConcurrencyField } from '../concurrency'

export const Programs: CollectionConfig = {
  slug: 'programs',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'forecast', 'confidence', 'owner', 'updatedAt'],
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
    { name: 'clientId', type: 'text', required: true, unique: true, index: true },
    {
      name: 'planningCycle',
      type: 'relationship',
      relationTo: 'planning-cycles' as never,
      required: true,
      index: true,
    },
    { name: 'outcomeId', type: 'text', required: true, defaultValue: 'pipeline' },
    { name: 'name', type: 'text', required: true },
    { name: 'forecast', type: 'number', required: true, min: 0 },
    { name: 'hexForecast', type: 'number', min: 0 },
    {
      name: 'confidence',
      type: 'select',
      required: true,
      options: ['high', 'medium', 'low'],
    },
    { name: 'historyNote', type: 'textarea' },
    { name: 'asanaGid', type: 'text', index: true },
    { name: 'asanaProjectGid', type: 'text' },
    { name: 'owner', type: 'text' },
    { name: 'salesforceCampaignId', type: 'text', index: true },
    { name: 'salesforceCampaignUrl', type: 'text' },
    { name: 'region', type: 'text' },
    { name: 'subRegion', type: 'text' },
    { name: 'channel', type: 'text' },
    { name: 'language', type: 'text' },
    { name: 'product', type: 'text' },
    { name: 'segment', type: 'text' },
  ],
}

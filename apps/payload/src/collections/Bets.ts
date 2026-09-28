import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated, plannerOrAbove } from '../access'
import { enforceOptimisticConcurrency, optimisticConcurrencyField } from '../concurrency'

export const Bets: CollectionConfig = {
  slug: 'bets',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'planningCase', 'status', 'owner', 'updatedAt'],
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
    { name: 'region', type: 'text' },
    { name: 'quarter', type: 'text' },
    { name: 'owner', type: 'text' },
    { name: 'rangeLow', type: 'number', required: true, min: 0 },
    { name: 'rangeHigh', type: 'number', required: true, min: 0 },
    { name: 'planningCase', type: 'number', required: true, min: 0 },
    { name: 'hexForecast', type: 'number', min: 0 },
    { name: 'price', type: 'number', min: 0 },
    { name: 'capacity', type: 'textarea' },
    { name: 'hypothesis', type: 'textarea' },
    { name: 'comparable', type: 'textarea' },
    { name: 'decisionRule', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['fund', 'test', 'stop', 're-plan', 'pending'],
    },
    { name: 'asanaGid', type: 'text', index: true },
    { name: 'asanaProjectGid', type: 'text' },
    { name: 'dueOn', type: 'date' },
    { name: 'salesforceCampaignId', type: 'text', index: true },
    { name: 'salesforceCampaignUrl', type: 'text' },
    { name: 'subRegion', type: 'text' },
    { name: 'channel', type: 'text' },
    { name: 'language', type: 'text' },
    { name: 'product', type: 'text' },
    { name: 'segment', type: 'text' },
  ],
}

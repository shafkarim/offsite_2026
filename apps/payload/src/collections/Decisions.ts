import type { CollectionConfig } from 'payload'

import { adminOnly, approverOrAbove, authenticated } from '../access'
import { enforceOptimisticConcurrency, optimisticConcurrencyField } from '../concurrency'

export const Decisions: CollectionConfig = {
  slug: 'decisions',
  admin: {
    useAsTitle: 'entityId',
    defaultColumns: ['entityType', 'entityId', 'decision', 'reviewer', 'decisionDate'],
  },
  access: {
    read: authenticated,
    create: approverOrAbove,
    update: approverOrAbove,
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
      name: 'planningCycle',
      type: 'relationship',
      relationTo: 'planning-cycles' as never,
      required: true,
      index: true,
    },
    {
      name: 'entityType',
      type: 'select',
      required: true,
      options: ['planning-cycle', 'program', 'bet', 'activity-plan'],
    },
    { name: 'entityId', type: 'text', required: true, index: true },
    {
      name: 'decision',
      type: 'select',
      required: true,
      options: ['fund', 'test', 'stop', 're-plan', 'pending'],
    },
    { name: 'rationale', type: 'textarea', required: true },
    { name: 'reviewer', type: 'relationship', relationTo: 'users', required: true },
    { name: 'decisionDate', type: 'date', required: true },
  ],
}

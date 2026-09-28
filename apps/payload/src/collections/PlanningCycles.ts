import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated, plannerOrAbove } from '../access'
import { enforceOptimisticConcurrency, optimisticConcurrencyField } from '../concurrency'

export const PlanningCycles: CollectionConfig = {
  slug: 'planning-cycles',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'fiscalYear', 'status', 'pipelineTarget', 'updatedAt'],
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
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'fiscalYear',
      type: 'number',
      required: true,
      min: 2026,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'active', 'locked', 'archived'],
    },
    {
      name: 'pipelineTarget',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Marketing-sourced pipeline target in millions.',
      },
    },
    {
      name: 'targetMultiplier',
      type: 'number',
      required: true,
      defaultValue: 1.1,
      min: 0,
    },
    {
      name: 'decisionOverride',
      type: 'select',
      options: ['fund', 'test', 'stop', 're-plan', 'pending'],
    },
    {
      name: 'methodologyNote',
      type: 'textarea',
      admin: {
        description: 'Planning methodology only. Do not paste raw customer or opportunity data.',
      },
    },
  ],
}

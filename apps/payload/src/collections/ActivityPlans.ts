import type { CollectionConfig } from 'payload'

import { adminOnly, authenticated, plannerOrAbove } from '../access'
import { enforceOptimisticConcurrency, optimisticConcurrencyField } from '../concurrency'

export const ActivityPlans: CollectionConfig = {
  slug: 'activity-plans',
  admin: {
    useAsTitle: 'activityName',
    defaultColumns: ['activityName', 'externalActivityId', 'status', 'updatedAt'],
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
    { name: 'externalActivityId', type: 'text', required: true, unique: true, index: true },
    { name: 'activityName', type: 'text', required: true },
    {
      name: 'planningCycle',
      type: 'relationship',
      relationTo: 'planning-cycles' as never,
      required: true,
      index: true,
    },
    { name: 'reachOverride', type: 'number', min: 0 },
    { name: 'mqlForecastOverride', type: 'number', min: 0 },
    { name: 'saoForecastOverride', type: 'number', min: 0 },
    { name: 'pipelineForecastOverride', type: 'number', min: 0 },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: ['draft', 'submitted', 'approved', 'archived'],
    },
    {
      name: 'comment',
      type: 'textarea',
      admin: {
        description: 'Planning rationale only. Do not enter customer or prospect details.',
      },
    },
  ],
}

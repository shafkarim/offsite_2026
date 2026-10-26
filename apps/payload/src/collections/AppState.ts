import type { Access, CollectionConfig } from 'payload'

import { authenticated, roleOf } from '../access'
import { enforceOptimisticConcurrency, optimisticConcurrencyField } from '../concurrency'

const LEGACY_GOVERNED_SNAPSHOT_KEY = 'integration:hex:semantic-approved-output:v1'

const canCreatePlanningState: Access = ({ data, req }) =>
  ['planner', 'approver', 'admin'].includes(roleOf(req.user) ?? '') &&
  data?.key !== LEGACY_GOVERNED_SNAPSHOT_KEY

const canUpdatePlanningState: Access = ({ req }) =>
  ['planner', 'approver', 'admin'].includes(roleOf(req.user) ?? '')
    ? { key: { not_equals: LEGACY_GOVERNED_SNAPSHOT_KEY } }
    : false

const canDeletePlanningState: Access = ({ req }) =>
  roleOf(req.user) === 'admin'
    ? { key: { not_equals: LEGACY_GOVERNED_SNAPSHOT_KEY } }
    : false

/**
 * Small, non-sensitive shared state used by the original Figma Make interface.
 * Approved semantic data remains outside Payload; this collection only stores
 * planning inputs, aggregate overrides, and UI configuration.
 */
export const AppState: CollectionConfig = {
  slug: 'app-state',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'updatedAt'],
  },
  access: {
    read: authenticated,
    create: canCreatePlanningState,
    update: canUpdatePlanningState,
    delete: canDeletePlanningState,
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
      admin: {
        description: 'Non-sensitive planning state only. Never store raw lead, contact, session, or opportunity data.',
      },
    },
  ],
}

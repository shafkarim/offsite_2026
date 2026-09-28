import type { GlobalConfig } from 'payload'

import { adminOnly, authenticated } from '../access'

export const ForecastSettings: GlobalConfig = {
  slug: 'forecast-settings',
  access: {
    read: authenticated,
    update: adminOnly,
  },
  versions: {
    max: 100,
  },
  fields: [
    {
      name: 'environmentLabel',
      type: 'text',
      required: true,
      defaultValue: 'Figma staging',
      admin: { readOnly: true },
    },
    {
      name: 'fy27Multiplier',
      type: 'number',
      required: true,
      defaultValue: 1.1,
      min: 0,
    },
    {
      name: 'semanticApprovedSourcesOnly',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: { readOnly: true },
    },
    {
      name: 'orgsWebFormReleaseStatus',
      type: 'select',
      required: true,
      defaultValue: 'blocked-ds-validation',
      options: ['blocked-ds-validation', 'internal-validation', 'approved'],
    },
  ],
}


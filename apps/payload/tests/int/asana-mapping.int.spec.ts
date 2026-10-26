import { describe, expect, it } from 'vitest'

import { mappingCoverage, normalizeAsanaLabel, normalizeAsanaTask } from '@/integrations/asana'

describe('Asana activity mapping', () => {
  it('normalizes punctuation and spacing in custom field labels', () => {
    expect(normalizeAsanaLabel('  MQLs — Forecast  ')).toBe('mqls forecast')
    expect(normalizeAsanaLabel('Channel / Tactic')).toBe('channel tactic')
  })

  it('maps approved field aliases and numeric text without requiring Salesforce', () => {
    const activity = normalizeAsanaTask({
      gid: 'asana-1',
      name: 'EMEA webinar',
      due_on: '2026-10-20',
      custom_fields: [
        { name: 'Campaign Channel', type: 'enum', enum_value: { name: 'Webinar/Livestream' } },
        { name: 'Marketing Region', type: 'enum', enum_value: { name: 'EMEA' } },
        { name: 'MQLs — Forecast', type: 'text', text_value: '1,250' },
      ],
    })

    expect(activity).toMatchObject({
      id: 'asana-1',
      channel: 'Webinar',
      region: 'EMEA',
      mql: 1250,
      sfdc: null,
    })
  })

  it('reports mapping coverage separately from total activities', () => {
    const first = normalizeAsanaTask({
      gid: 'asana-1',
      name: 'Mapped activity',
      custom_fields: [
        { name: 'Channel', type: 'enum', enum_value: { name: 'Email' } },
        { name: 'Region', type: 'enum', enum_value: { name: 'AMER' } },
        { name: 'MQL target', type: 'number', number_value: 20 },
      ],
    })
    const second = normalizeAsanaTask({ gid: 'asana-2', name: 'Unmapped activity' })
    const activities = [first, second].filter((item): item is NonNullable<typeof item> => item !== null)

    expect(mappingCoverage(activities)).toEqual({
      total: 2,
      channel: 1,
      region: 1,
      subRegion: 0,
      mqlForecast: 1,
      salesforceCampaign: 0,
    })
  })
})

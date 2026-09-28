export const SUPPORT_LEADS_EVIDENCE = {
  conversionExtract: [
    { period: "2026-01-01", mql: 380, sao: 30, mature: true },
    { period: "2026-04-01", mql: 501, sao: 27, mature: true },
    { period: "2026-07-01", mql: 437, sao: 23, mature: false },
  ],
  pacingSnapshot: {
    period: "2026-07-01",
    asOf: "2026-09-10",
    mql: 673,
    sao: 32,
  },
} as const

const conversionQ3 = SUPPORT_LEADS_EVIDENCE.conversionExtract[2]
const pacingQ3 = SUPPORT_LEADS_EVIDENCE.pacingSnapshot

export const SUPPORT_LEADS_RECONCILIATION_RESULT =
  `${conversionQ3.mql} / ${conversionQ3.sao} vs ${pacingQ3.mql} / ${pacingQ3.sao}`

export const SUPPORT_LEADS_REVIEW_ACTION =
  `Reconcile the Q3 conversion extract (${conversionQ3.mql} MQL / ${conversionQ3.sao} SAO) with pacing actuals (${pacingQ3.mql} MQL / ${pacingQ3.sao} SAO), then approve the source definition.`


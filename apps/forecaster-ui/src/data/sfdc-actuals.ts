// Certified MQL/SAO actuals from Salesforce via Hex (DWH_ANALYTICS.MARKETING)
// Keyed by SFDC Campaign ID → app quarterFilter date string → { mql, sao }
// Quarter mapping: "2026-01-01"=Q1, "2026-04-01"=Q2, "2026-07-01"=Q3
// Freshness: 2026-09-10 · campaigns absent had zero actuals and are omitted

export const SFDC_ACTUALS: Record<string, Record<string, { mql: number; sao: number }>> = {
  "701PX00000c7lpBYAQ": {
    "2026-07-01": { mql: 0, sao: 1 },
  },
  "701PX00000cO018YAC": {
    "2026-01-01": { mql: 1, sao: 0 },
    "2026-04-01": { mql: 0, sao: 1 },
  },
  "701PX00000eHGg2YAG": {
    "2026-01-01": { mql: 26, sao: 0 },
    "2026-04-01": { mql: 0, sao: 1 },
  },
  "701PX00000eRVn5YAG": {
    "2026-01-01": { mql: 477, sao: 5 },
    "2026-04-01": { mql: 0, sao: 2 },
  },
  "701PX00000f8UFpYAM": {
    "2026-01-01": { mql: 341, sao: 8 },
    "2026-04-01": { mql: 1, sao: 3 },
  },
  "701PX00000fYwLQYA0": {
    "2026-01-01": { mql: 29, sao: 1 },
  },
  "701PX00000fZK13YAG": {
    "2026-01-01": { mql: 3, sao: 0 },
    "2026-04-01": { mql: 1, sao: 0 },
  },
  "701PX00000fw5HUYAY": {
    "2026-01-01": { mql: 105, sao: 1 },
  },
  "701PX00000gP2eNYAS": {
    "2026-01-01": { mql: 207, sao: 7 },
    "2026-04-01": { mql: 0, sao: 2 },
  },
  "701PX00000gUvdpYAC": {
    "2026-01-01": { mql: 1251, sao: 13 },
    "2026-04-01": { mql: 10, sao: 7 },
  },
  "701PX00000gdKWYYA2": {
    "2026-01-01": { mql: 469, sao: 3 },
    "2026-04-01": { mql: 2, sao: 1 },
  },
  "701PX00000glQDSYA2": {
    "2026-01-01": { mql: 92, sao: 0 },
    "2026-04-01": { mql: 2, sao: 1 },
  },
  "701PX00000grBWbYAM": {
    "2026-01-01": { mql: 51, sao: 0 },
    "2026-04-01": { mql: 8, sao: 0 },
  },
  "701PX00000hIirRYAS": {
    "2026-01-01": { mql: 12, sao: 0 },
  },
  "701PX00000hKJKHYA4": {
    "2026-01-01": { mql: 1305, sao: 11 },
    "2026-04-01": { mql: 0, sao: 7 },
  },
  "701PX00000hdukpYAA": {
    "2026-01-01": { mql: 17, sao: 0 },
    "2026-04-01": { mql: 8, sao: 2 },
    "2026-07-01": { mql: 1, sao: 0 },
  },
  "701PX00000iAxruYAC": {
    "2026-01-01": { mql: 121, sao: 0 },
    "2026-04-01": { mql: 4, sao: 2 },
  },
  "701PX00000icqvWYAQ": {
    "2026-04-01": { mql: 11, sao: 1 },
  },
  "701PX00000igadpYAA": {
    "2026-01-01": { mql: 43, sao: 0 },
    "2026-04-01": { mql: 1092, sao: 13 },
    "2026-07-01": { mql: 0, sao: 3 },
  },
  "701PX00000ih6C5YAI": {
    "2026-01-01": { mql: 72, sao: 0 },
    "2026-04-01": { mql: 347, sao: 11 },
    "2026-07-01": { mql: 21, sao: 1 },
  },
  "701PX00000jCb6oYAC": {
    "2026-04-01": { mql: 2, sao: 0 },
  },
  "701PX00000jol54YAA": {
    "2026-04-01": { mql: 111, sao: 1 },
    "2026-07-01": { mql: 1, sao: 0 },
  },
  "701PX00000q3185YAA": {
    "2026-07-01": { mql: 15, sao: 0 },
  },
};

export function lookupSfdcActuals(
  campaignId: string | null | undefined,
  quarter: string
): { mql: number; sao: number } | null {
  if (!campaignId) return null;
  return SFDC_ACTUALS[campaignId]?.[quarter] ?? null;
}

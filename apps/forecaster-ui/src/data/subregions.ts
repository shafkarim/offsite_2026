export const SALES_REGIONS = ["AMER", "EMEA", "APAC", "JAPAN", "LATAM"] as const
export type SalesRegion = (typeof SALES_REGIONS)[number]

// The approved sub-region taxonomy currently applies only to APAC and EMEA.
// AMER, JAPAN, and LATAM remain valid parent regions, but are not sub-regions.
export const SUB_REGION_PARENT_REGIONS = ["APAC", "EMEA"] as const

export const SUB_REGIONS_BY_REGION: Record<SalesRegion, readonly string[]> = {
  AMER: [],
  EMEA: [
    "Africa",
    "DACH/EEC",
    "Frabelux",
    "Iberia/Italy",
    "Israel",
    "ME",
    "Mediterranean",
    "Netherlands",
    "Nordics",
    "South Africa",
    "Turkey",
    "UKI",
  ],
  APAC: [
    "ANZ & Oceania",
    "Greater China Region",
    "Korea",
    "South Asia",
    "Southeast Asia",
  ],
  JAPAN: [],
  LATAM: [],
}

const SUB_REGION_ALIASES: Record<string, string> = {
  DACH: "DACH/EEC",
  "UKI-SA": "UKI",
  NN: "Nordics",
  ANZ: "ANZ & Oceania",
  India: "South Asia",
  SEA: "Southeast Asia",
  "S-EMEA FR": "Frabelux",
  "S-EMEA ES": "Iberia/Italy",
  "S-EMEA IT": "Iberia/Italy",
  "S-EMEA PT": "Iberia/Italy",
  "EMEA: France": "Frabelux",
  "EMEA: Iberia / Italy": "Iberia/Italy",
}

export function normalizeSubRegion(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const clean = value
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, "")
    .trim()
  return SUB_REGION_ALIASES[clean] ?? clean
}

export function regionForSubRegion(value: string | null | undefined): SalesRegion | null {
  const normalized = normalizeSubRegion(value)
  if (!normalized) return null
  for (const region of SALES_REGIONS) {
    if (SUB_REGIONS_BY_REGION[region].includes(normalized)) return region
  }
  return null
}

export function subRegionsFor(region: string | null | undefined): readonly string[] {
  if (!region || !(region in SUB_REGIONS_BY_REGION)) return []
  return SUB_REGIONS_BY_REGION[region as SalesRegion]
}

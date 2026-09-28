// ─── Forecast model ─────────────────────────────────────────────────────────
//
// This file represents data that would be sourced from Hex in production.
// Current state: ALL values are analyst estimates / dummy data.
//
// PRODUCTION INTEGRATION (what Hex would provide):
//
//   1. Channel reach-to-MQL rates
//      Source: Hex notebook "Channel Attribution Rates"
//      Query: Salesforce Campaign Member attribution data, grouped by channel
//      Endpoint: GET https://app.hex.tech/api/v1/projects/{PROJECT_ID}/runs
//      Cadence: refresh quarterly
//
//   2. Activity reach counts (registrants, attendees, recipients)
//      Source: Hex notebook "Campaign Reach by Activity"
//      Query: joins Zoom Webinar API + Eventbrite + Iterable/Marketo send logs
//             matched to Salesforce Campaigns via UTM parameters
//      Key bridge: Asana task GID ↔ Salesforce Campaign ID
//      Status: GAP — this mapping does not exist yet
//
//   3. Post-event actual MQLs and SAOs per activity
//      Source: Hex notebook "Activity Actuals"
//      Query: Salesforce Opportunity + Lead attribution, 90-day lookback window
//      Status: GAP — not yet pulling into this app
//
// LOGIC GAPS (as of 2026-09-10):
//   ❌  No automated Asana GID → Salesforce Campaign ID mapping
//   ❌  Zoom / Eventbrite registrant data not flowing into Hex
//   ❌  Actual MQLs and SAOs not yet pulled per activity
//   ❌  Rates below not validated against FY26 historical data
//   ⚠️  Reach values in SAMPLE_REACH are seeded manually — not from any system

export type ReachUnit = "registrants" | "attendees" | "recipients" | "contacts" | "readers"

export interface ChannelRate {
  channel: string
  reachUnit: ReachUnit
  mqlRate: number
  source: "analyst-estimate"
  notes: string
}

// Channel engagement → MQL conversion rates
// These would be fetched from Hex and refreshed quarterly in production.
export const CHANNEL_RATES: ChannelRate[] = [
  {
    channel: "Webinar",
    reachUnit: "registrants",
    mqlRate: 0.082,
    source: "analyst-estimate",
    notes: "8.2% of registrants · based on Q1–Q2 FY26 webinar attribution",
  },
  {
    channel: "IRL Event",
    reachUnit: "attendees",
    mqlRate: 0.22,
    source: "analyst-estimate",
    notes: "22% of attendees · in-person events show higher purchase intent",
  },
  {
    channel: "Email",
    reachUnit: "recipients",
    mqlRate: 0.0085,
    source: "analyst-estimate",
    notes: "0.85% of recipients · ~3% CTR assumed, ~28% of clickers qualify",
  },
  {
    channel: "ABM",
    reachUnit: "contacts",
    mqlRate: 0.38,
    source: "analyst-estimate",
    notes: "38% of target contacts · highly focused named-account outreach",
  },
  {
    channel: "Newsletter",
    reachUnit: "readers",
    mqlRate: 0.004,
    source: "analyst-estimate",
    notes: "0.4% of readers · broad awareness, low-intent channel",
  },
  {
    channel: "Direct Mail",
    reachUnit: "recipients",
    mqlRate: 0.18,
    source: "analyst-estimate",
    notes: "18% of recipients · physical mail to high-value accounts",
  },
]

export function getChannelRate(channel: string): ChannelRate | undefined {
  return CHANNEL_RATES.find(r => r.channel === channel)
}

export function calcMqlFcst(reach: number, channel: string): number | null {
  const rate = getChannelRate(channel)
  if (!rate) return null
  return Math.round(reach * rate.mqlRate)
}

// ─── Sample reach data ────────────────────────────────────────────────────────
//
// Simulates what Hex would provide: engagement counts keyed by Asana task GID.
//
// Sep activities are seeded — representing data that Hex would have pulled from
// registration systems and email platforms. Oct–Dec are intentionally blank to
// visualise the planning gap for future activities.
//
// In production, the key challenge is the Asana GID → Salesforce Campaign ID
// mapping. UTM parameters are the most likely bridge, but are not consistently
// applied across all activities today.
export const SAMPLE_REACH: Record<string, number> = {
  // Webinars — registrant counts
  "1215939852671800": 420,   // Coinbase MCP Webinar
  "1218015572198528": 680,   // Executive Briefing: Accelerating...
  "1217493979686728": 340,   // Introducing Weave: Creative...
  "1217501761689668": 190,   // Coinbase MCP Webinar (on-demand)
  "1217389213538384": 280,   // Edenspiekermann Webinar (DE)
  "1216856916719153": 510,   // Sep 15 webinar
  "1217920655674297": 290,   // Sep 15 webinar (2)
  "1214776432222377": 760,   // Sep 16 webinar
  "1218015881559792": 380,   // Sep 22 webinar
  "1217646058751508": 450,   // Sep 22 webinar (2)
  "1217761931273834": 310,   // Sep 23 webinar
  "1217456098592832": 595,   // Sep 24 webinar
  "1217389213538389": 260,   // Sep 28 webinar
  "1216944320298632": 430,   // Sep 29 webinar
  // Oct+ webinars intentionally left blank — no registration data yet

  // IRL Events — expected attendees
  "1215588438927519": 65,    // Coffee Break Paris
  "1215485445047840": 72,    // Coffee Break Paris (2)
  "1214818690597149": 48,    // Women in Product NYC
  "1214045294047051": 22,    // Leadership Collective Toronto dinner
  "1213008273081514": 130,   // LeadDev 2026 NYC
  "1214045294047053": 38,    // Sep 17 event
  "1217561413656533": 85,    // Sep 24 event
  "1216090854079321": 54,    // Sep 29 event
  "1217389213538400": 41,    // Sep 30 event
  // Oct+ IRL Events intentionally left blank

  // Emails — recipient counts
  "1217963316020562": 6800,  // Edu Lifecycle Email Update
  "1218139389797003": 4200,  // Higher Ed Professor SheerID
  "1217891802836042": 9500,  // Customer story: expansion recovery
  "1217648683853866": 7200,  // Code Connect blog (EU)
  "1217723602772471": 3100,  // Primeros pasos email (ES)
  "1217723488241622": 2800,  // Office Hours email (FR)
  "1218055690118456": 11000, // Weave newsletter
  "1218124779667854": 1900,  // Sep17 JP Workflow Lab reminder
  "1217456098592812": 5400,  // Sep 15 email
  "1217792009777681": 8100,  // Sep 15 email (2)

  // ABM — target contact counts
  "1217389213334767": 28,    // SAP Impulse Shanghai
  "1212379277612963": 34,    // SAP Impulse Karlsruhe

  // Newsletter — subscriber count
  "1215809533028672": 18500, // Product Newsletter Aug/Sep

  // ─── AMER activities ─────────────────────────────────────────────────────
  // IRL Events — attendee estimates
  "1214818690597152": 45,    // CAB + US Open
  "1213008273081521": 95,    // ELC Annual 2026
  "1217152631465706": 28,    // Leadership Collective SF dinner (Josh Clemm)
  "1213008273081525": 110,   // GitHub Universe 2026
  "1213835504378576": 24,    // FigGov / Federal Sales dinner
  "1212864424136787": 32,    // Figma x FoF Government Community [Washington]
  "1213008270431757": 78,    // DeveloperWeek/ProductWorld 2026
  "1213830104839077": 26,    // Leadership Collective NYC dinner (Paige)
  "1213835504378565": 30,    // Leadership Collective SF dinner (Noah Levin)
  "1213008270431774": 140,   // Atlassian Team'26
  "1213008273081494": 60,    // UXDX 2026 NYC
  "1213835504378570": 34,    // Leadership Collective NYC (Spring / Config)
  "1214357915273130": 55,    // Workflow Lab
  "1213835504378560": 22,    // Leadership Collective Boston dinner (Shaunt)
  "1214045294047030": 27,    // Leadership Collective NYC dinner (Tommy MacWill)
  "1214045294047046": 31,    // Leadership Collective Chicago dinner (Jake Al)
  "1214045294047048": 25,    // Leadership Collective SF dinner (Josh Clemm 2)
  // ABM — target contact counts
  "1214818690597137": 22,    // ABM Event - UHG
  "1211973318153286": 18,    // ABM Dinner - NYC (FinServ)
  "1211973315657279": 30,    // Virtual ABM Coffee Break (Product Persona)
  "1211973318153283": 20,    // ABM Hospitality Event
  "1211973318153300": 16,    // ABM Dinner - SF (Product Persona)
  "1211973318153318": 19,    // ABM LC Eng Dinner - NYC
  "1213860494018829": 17,    // ABM LC Dinner - Seattle
  "1213726648488900": 21,    // ABM LC Dinner - LA
  "1213726432479186": 35,    // Virtual ABM Executive Roundtable
  "1214818690597146": 28,    // Virtual ABM Executive Roundtable (2)
  "1214818690597155": 38,    // ABM Event - T-Mobile

  // Webinars — registrant counts
  "1209278308951838": 520,   // Tactical guide for handoff
  "1209915199476193": 610,   // In the file: How Typeform unified
  "1209730634294127": 280,   // Swoogo (Pro to Org) [cancelled]
  "1211516616392758": 390,   // Figma & GitHub webinar
  "1211942097291791": 310,   // Office Hours: Design Systems in Figma Make
  "1212154857923281": 430,   // Design to Code with Figma MCP and OpenAI
  "1212420684017748": 480,   // Make connectors partner panel
  "1212523974809536": 540,   // Software is Culture
  "1212523974809543": 350,   // Release Notes
  "1213482515234646": 290,   // OH: Faster Product Discovery
  "1213504368884331": 510,   // From Claude Code to Figma – and Back
  "1214074555538335": 460,   // How to use Figma when code is your source
  "1214355976704202": 620,   // Executive Briefing
  "1214910304952497": 330,   // Workflow Lab: How Adyen is transforming
  "1214757184765519": 570,   // Gui Seiz: Executive Briefing: The Next
  "1214782359273821": 490,   // Leadership Collective - Executive Briefing
  "1215939852671751": 380,   // Workflow Lab: From context to code
  "1217494214197266": 650,   // Executive Briefing: The Weave Roadmap

  // ─── LATAM activities ────────────────────────────────────────────────────
  // Emails — recipient counts
  "1217993460750778": 2400,  // Content Launch - AI Buyers Guide (MX)
  "1218002657973752": 3100,  // Content Launch - AI Buyers Guide (BR)
  "1212391050552492": 1800,  // Email Invite 1 - MCP Webinar (BR)
  "1212391054017291": 1700,  // Email Invite 2 - MCP Webinar (BR)

  // IRL Events — attendee estimates
  "1212654595698792": 75,    // Figma + Globo (BR)

  // Webinars — registrant counts
  "1211419057162040": 240,   // PT Getting Started with Make Webinar
  "1212154997912992": 320,   // Webinar - MCP iFood (BR)

  // ─── JAPAN activities ────────────────────────────────────────────────────
  // Emails — recipient counts
  "1217993462717927": 1600,  // Content Launch - AI Buyers Guide (JP)

  // ─── APAC activities ─────────────────────────────────────────────────────
  // Emails — recipient counts
  "1218006488224479": 2200,  // Content Launch - AI Buyers Guide (KR)

  // Webinars — registrant counts
  "1211621670366940": 280,   // Office Hours: Building aligned design sys (KR)

  // ─── Historical EMEA Webinars (FY25/early FY26 — mql>0 actuals) ─────────
  // Reach = registrant counts; MQL conversion ~6.5% for full webinars, ~5.5% for
  // office hours / on-demand recordings (lower intent / gated replays).
  "1211215690167949": 1540,  // Webinar - How PMs at Figma use Make
  "1211215690167946": 1480,  // Webinar - How Engineers at Figma use Dev Mode
  "1211215690167943": 1650,  // Webinar - How Designers at Figma use Design System
  "1210584602214048": 920,   // [LIVESTREAM] Improving Design to Code with Dev
  "1210519913668491": 460,   // [LIVESTREAM] MCP Server Webinar - German
  "1210743167915994": 1700,  // [WEBINAR] In The File - Multibrand Design Systems
  "1210547180460757": 1160,  // [WW Webinar] Design Systems Webinar
  "1210812581814041": 360,   // Webinar - Office Hours Figma Sites
  "1210845518037130": 360,   // Office Hours Auto layout 101 (FR)
  "1211042906086011": 1520,  // Webinar - Getting Started with Make
  "1210523295916114": 1390,  // Webinar - Vertiefung in skalierbare Designsysteme (DE)
  "1210547180460781": 780,   // Webinar - Shifting Roles – AI Vision/Platform
  "1210878574568979": 1450,  // Webinar - Dev Mode, MCP & Code Connect
  "1211197973240021": 1240,  // Getting Started with Make Webinar (ES/MX)
  "1211197973240026": 1210,  // Getting Started with Make Webinar (FR)
  "1211064232020088": 900,   // On Demand Recording - SMB Pro > Org Event
  "1210881308022023": 90,    // On Demand Recording - Make Champion Persona Event
  "1211162361866704": 1750,  // Webinar - Einführung in Figma Make (DE)
  "1211215690167937": 1280,  // Webinar - Extended Collections
  "1212373705277273": 1010,  // Webinar - Office Hours - Extended Collections
  "1211977860542712": 310,   // Webinar - In The File - Botim
  "1211296841058362": 1580,  // Webinar - The business value of design systems
  "1212353942120077": 620,   // Webinar - Adaptive design workflows for agencies
  "1211452782993299": 1620,  // Webinar - State of the Designer 2026
  "1213037615956845": 1300,  // Webinar - State of the Designer
  "1212303940184008": 210,   // Office Hours - Mejorar la generación de leads (ES)
  "1212303940184045": 70,    // Office Hours - Enterprise Admin 101 (FR)
  "1213776333128209": 220,   // OH - Fermer la boucle entre code et design (FR)
  "1212378486464322": 1420,  // Webinar - Figma Skills in der Praxis (DE)

  // ─── Historical EMEA IRL Events (FY25/early FY26 — mql>0 actuals) ────────
  // Reach = in-person attendee counts; MQL conversion ~25% for targeted events,
  // ~20% for larger/community events.
  "1210986949511986": 18,    // Event - Leadership Collective - Forrester TEI Dev
  "1210728326221378": 25,    // WeAreDevelopers World Congress: Berlin
  "1210798130488842": 18,    // [EVENT] AI Executive Roundtable London
  "1210531159968027": 11,    // Event - Leadership Collective - Berlin
  "1210799127703055": 40,    // Madrid Coffee Break - MCP server (ES)
  "1210799127703073": 46,    // FoF Madrid x Figma Event - Figma Make (ES)
  "1210799123532879": 7,     // Madrid VIP Dinner - TEI + Platform (ES)
  "1210799125908451": 7,     // Riyadh VIP Dinner or Breakfast TEI + Platform
  "1211197887012556": 22,    // Event - Community - Ladies that UX
  "1210799123532867": 42,    // FoF Dubai x Figma Event - Figma Make (AE)
  "1211064232020129": 88,    // Event - Constellation - Workshop Amsterdam
  "1211064232020134": 42,    // Event - Constellation - Leadership Collective Amsterdam
  "1211064232020145": 88,    // Event - Constellation - Field Event & EBCs Amsterdam
  "1210878574568960": 12,    // Event - Leadership Collective (German Product Launch)
  "1211436177896160": 46,    // Figma Commons Paris (FR)
  "1210878574568967": 60,    // Event - Maker Collective (German Product Launch Düsseldorf)
  "1211064232017866": 80,    // Event - SMB Pro > Org
  "1211162361865584": 20,    // Event - Berlin Schema Watch Party
  "1211288398853643": 7,     // Event - Leadership Collective Dinner - Berlin
  "1210881308022011": 60,    // Event - Make Champion Persona
  "1211197973935119": 44,    // Make With Notion Paris (FR)
  "1213711358112808": 20,    // Paris Coffee Break with Theodo, BPIFrance (FR)
  "1212303940184100": 8,     // Owned Event - Leadership Collective Milan
  "1210881308021989": 20,    // Event - South Africa (CT) - Leadership Collective
  "1212303940184093": 22,    // Owned Event - Builder's Day Madrid (ES)
  "1212303940184067": 62,    // Co-marketed Event - Product Tank Barcelona (ES)

  // ─── Historical global / untagged Webinars (FY25/early FY26) ────────────
  "1211336566260032": 500,   // Webinar - MCP + CC
  "1211336566493794": 500,   // Webinar - Plaid
  "1211336566493806": 490,   // Webinar - PM Make

  // ─── Historical EMEA Emails (FY25/early FY26 — mql>0 actuals) ──────────
  // Reach = email recipient counts; MQL conversion ~1.5% for invite-style sends.
  "1213214994645424": 4700,  // Email Invite 1 - SOTD Webinar
  "1210798504169836": 1350,  // MCP On-Demand Video Email (FR)

  // ─── Historical IRL Event — no region tag ───────────────────────────────
  "1210799127703053": 8,     // Dubai VIP Breakfast - TEI + Platform

  // ─── Historical EMEA ABM (FY25/early FY26 — mql>0 actuals) ────────────
  // Reach = targeted contact counts; MQL conversion ~28% for gifting/ABM.
  "1215440029620266": 18,    // 1:Few - Summer gifting: Config Zines
}

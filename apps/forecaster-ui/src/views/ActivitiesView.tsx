import React, { useState, useMemo, useCallback, useRef } from "react"
import { Activity } from "../asana"
import { lookupActuals, ACTUALS_QUARTERS } from "../data/conversion-breakdowns"
import { SAMPLE_REACH, getChannelRate, calcMqlFcst } from "../data/forecast-model"
import { lookupSfdcActuals } from "../data/sfdc-actuals"
import { usePayloadValue } from "../payload"
import { useLiveAsana } from "../live-sources"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const MONTH_WORDS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"]
const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"]

function sectionDate(section: string): string | null {
  const up = section.toUpperCase()
  const ym = up.match(/(\d{4})/)
  if (!ym) return null
  const year = ym[1]
  let m = MONTH_WORDS.findIndex(w => up.includes(w))
  if (m < 0) m = MONTH_ABBR.findIndex(w => up.includes(w))
  if (m < 0) return null
  return `${year}-${String(m + 1).padStart(2, "0")}-01`
}

function activityDate(a: Activity): string | null {
  return a.due || sectionDate(a.section)
}

function fmtShort(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${Number(d)} ${MONTHS[+m - 1]}`
}

function fmtMonthYear(iso: string): string {
  const [y, m] = iso.split("-")
  return `${MONTHS_FULL[+m - 1]} ${y}`
}

const TODAY = new Date().toISOString().slice(0, 10)

const SALES_REGIONS = ["AMER","EMEA","APAC","JAPAN","LATAM"]

const SALES_REGION_MAP: Record<string, string> = {
  "AMER": "AMER", "NAMER": "AMER", "NA": "AMER",
  "EMEA": "EMEA", "UKI-SA": "EMEA", "DACH": "EMEA",
  "APAC": "APAC", "ANZ": "APAC", "Korea": "APAC", "SEA": "APAC",
  "Japan": "JAPAN", "JAPAN": "JAPAN",
  "LATAM": "LATAM",
}
const GLOBAL_VALUES = ["Global","GLOBAL","WW","Worldwide","All Regions"]

function salesRegionsOf(a: Activity): string[] {
  const parts = (a.region || "").split(",").map(r => r.trim()).filter(Boolean)
  if (parts.some(r => GLOBAL_VALUES.some(g => r.includes(g)))) return [...SALES_REGIONS]
  const hits = new Set<string>()
  parts.forEach(r => {
    const sr = SALES_REGION_MAP[r] || Object.entries(SALES_REGION_MAP).find(([k]) => r.includes(k))?.[1]
    if (sr) hits.add(sr)
  })
  return [...hits]
}

const COUNTRY_FLAGS: Record<string, string> = {
  "Singapore": "🇸🇬", "ANZ": "🇦🇺", "Japan": "🇯🇵",
  "Korea": "🇰🇷", "UKI": "🇬🇧", "DACH": "🇩🇪",
}

const REGION_FLAGS: Record<string, string> = {
  "AMER": "🌎", "NAMER": "🌎", "NA": "🌎", "LATAM": "🌎",
  "EMEA": "🌍",
  "APAC": "🌏", "SEA": "🌏", "APAC-Wide": "🌏",
  "JAPAN": "🇯🇵",
}

// FY26 Q1–Q3 quarterly average used as single-quarter reference target
const FY26_REGION_REF: Record<string, { mql: number; sao: number }> = {
  AMER:  { mql: Math.round((4616+8253+7122)/3), sao: Math.round((459+463+382)/3) },
  EMEA:  { mql: Math.round((5837+5642+5004)/3), sao: Math.round((449+478+318)/3) },
  APAC:  { mql: Math.round((2783+1774+2766)/3), sao: Math.round((174+116+114)/3) },
  JAPAN: { mql: Math.round((923+1242+885)/3),   sao: Math.round((139+87+114)/3) },
  LATAM: { mql: Math.round((1860+2109+2213)/3), sao: Math.round((190+152+149)/3) },
}

function calcActivityConfidence(a: Activity, ov: Partial<ActivityOverride>): "high" | "medium" | "low" {
  const hasOverride = (ov.reach !== undefined && ov.reach !== null) || (ov.mqlFcst !== undefined && ov.mqlFcst !== null)
  if (hasOverride) return "high"
  if (SAMPLE_REACH[a.id] != null) return "medium"
  return "low"
}

function regionDisplay(region: string | null): { flag: string; text: string } | null {
  if (!region) return null
  const parts = region.split(",").map(r => r.trim()).filter(Boolean)
  const flag =
    COUNTRY_FLAGS[parts[0]] ||
    REGION_FLAGS[parts[0]] ||
    REGION_FLAGS[parts[0]?.split("-")[0]] ||
    ""
  return { flag, text: region }
}

type DateFilter = "all" | "sep" | "oct" | "nov" | "dec" | "q3" | "q4" | "next30" | "custom"

const DATE_TABS: { id: DateFilter; label: string }[] = [
  { id: "all",    label: "All" },
  { id: "sep",    label: "Sep 26" },
  { id: "oct",    label: "Oct 26" },
  { id: "nov",    label: "Nov 26" },
  { id: "dec",    label: "Dec 26" },
  { id: "q3",     label: "Q3 26" },
  { id: "q4",     label: "Q4 26" },
  { id: "next30", label: "Next 30 days" },
]

function applyDateFilter(
  activities: Activity[],
  filter: DateFilter,
  from: string,
  to: string
): Activity[] {
  return activities.filter(a => {
    const d = activityDate(a)
    if (!d) return false
    switch (filter) {
      case "all":    return d >= TODAY
      case "sep":    return d >= "2026-09-01" && d <= "2026-09-30"
      case "oct":    return d >= "2026-10-01" && d <= "2026-10-31"
      case "nov":    return d >= "2026-11-01" && d <= "2026-11-30"
      case "dec":    return d >= "2026-12-01" && d <= "2026-12-31"
      case "q3":     return d >= "2026-07-01" && d <= "2026-09-30" && d >= TODAY
      case "q4":     return d >= "2026-10-01" && d <= "2026-12-31"
      case "next30": {
        const end = new Date()
        end.setDate(end.getDate() + 30)
        return d >= TODAY && d <= end.toISOString().slice(0, 10)
      }
      case "custom": {
        if (from && d < from) return false
        if (to && d > to) return false
        return d >= TODAY
      }
    }
  })
}

// ── Per-activity editable overrides (shared Payload state) ───────────────────

const OVERRIDES_KEY = "activity_overrides_v1"

interface ActivityOverride {
  reach: number | null
  mqlFcst: number | null
  saoFcst: number | null
  mqlActual: number | null
  saoActual: number | null
  status: "postponed" | "cancelled" | null
  comment: string | null
}

type OverridesMap = Record<string, Partial<ActivityOverride>>

function useActivityOverrides() {
  const { value: overrides, setValue: setOverrides } = usePayloadValue<OverridesMap>(OVERRIDES_KEY, {})

  const setField = useCallback(
    (id: string, field: keyof Pick<ActivityOverride, "reach" | "mqlFcst" | "saoFcst" | "mqlActual" | "saoActual">, value: number | null) => {
      setOverrides(prev => {
        const next = { ...prev, [id]: { ...prev[id], [field]: value } }
        return next
      })
    },
    []
  )

  const setStringField = useCallback(
    (id: string, field: keyof Pick<ActivityOverride, "status" | "comment">, value: string | null) => {
      setOverrides(prev => {
        const next = { ...prev, [id]: { ...prev[id], [field]: value } }
        return next
      })
    },
    []
  )

  return { overrides, setField, setStringField }
}

// ── EditableNum: click-to-edit inline number cell ─────────────────────────────

function EditableNum({
  value,
  onChange,
  computed = false,
  sublabel,
}: {
  value: number | null
  onChange: (v: number | null) => void
  computed?: boolean
  sublabel?: string
}) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState("")

  const focusAndSelect = useCallback((el: HTMLInputElement | null) => {
    if (el) { el.focus(); el.select() }
  }, [])

  function commit() {
    const cleaned = raw.replace(/[^0-9]/g, "")
    onChange(cleaned === "" ? null : parseInt(cleaned, 10))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={focusAndSelect}
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); commit() }
          if (e.key === "Escape") setEditing(false)
        }}
        className="w-full text-right font-mono text-xs border-b border-brand-black focus:outline-none bg-transparent tabular-nums py-0.5"
        placeholder="0"
      />
    )
  }

  return (
    <button
      onClick={() => { setRaw(value != null ? String(value) : ""); setEditing(true) }}
      title={computed ? "Auto-calculated · click to override" : "Click to edit"}
      className="font-mono text-xs tabular-nums text-right w-full block group"
    >
      {value != null ? (
        <span className={computed ? "text-brand-medium-gray group-hover:underline decoration-dotted underline-offset-2" : "text-brand-black group-hover:underline decoration-dotted underline-offset-2"}>
          {value.toLocaleString()}
          {sublabel && <span className="block font-mono text-[9px] text-brand-medium-gray leading-tight">{sublabel}</span>}
        </span>
      ) : (
        <span className="text-brand-medium-gray group-hover:text-brand-black transition-colors">—</span>
      )}
    </button>
  )
}

// ── EditPanel: slide-in drawer for editing activity forecasts ─────────────────

function EditPanel({
  activity,
  overrides,
  setField,
  setStringField,
  quarterFilter,
  onClose,
}: {
  activity: Activity | null
  overrides: OverridesMap
  setField: (id: string, field: keyof Pick<ActivityOverride, "reach" | "mqlFcst" | "saoFcst" | "mqlActual" | "saoActual">, value: number | null) => void
  setStringField: (id: string, field: keyof Pick<ActivityOverride, "status" | "comment">, value: string | null) => void
  quarterFilter: string
  onClose: () => void
}) {
  const isOpen = activity !== null

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  if (!activity) {
    return (
      <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-brand-light-gray shadow-2xl transform translate-x-full transition-transform duration-300 ease-out z-50 pointer-events-none" />
    )
  }

  const a = activity
  const ov = overrides[a.id] ?? {}
  const channelRate = a.channel ? getChannelRate(a.channel) : undefined
  const reachUnit = channelRate?.reachUnit ?? "Reach"
  const reachUnitLabel = reachUnit.charAt(0).toUpperCase() + reachUnit.slice(1)

  const sampleReach = SAMPLE_REACH[a.id] ?? null
  const reach: number | null = ov.reach !== undefined ? ov.reach : sampleReach
  const autoMqlFcst: number | null = reach != null && a.channel ? calcMqlFcst(reach, a.channel) : null
  const mqlFcst: number | null = ov.mqlFcst !== undefined ? ov.mqlFcst : autoMqlFcst ?? (a.mql ?? null)
  const benchmark = a.channel ? lookupActuals(quarterFilter, "Campaign channel", a.channel) : null
  const autoSaoFcst: number | null = mqlFcst != null && benchmark != null ? Math.round(mqlFcst * benchmark.conversionRate) : null
  const saoFcst: number | null = ov.saoFcst !== undefined ? ov.saoFcst : autoSaoFcst

  const sfdcActuals = lookupSfdcActuals(a.sfdc, quarterFilter)
  const autoMqlActual: number | null = sfdcActuals?.mql ?? null
  const autoSaoActual: number | null = sfdcActuals?.sao ?? null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 cursor-pointer"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-brand-light-gray shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-brand-light-gray flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest mb-1">
              {a.channel ?? "No channel"} · {a.region ?? "No region"}
            </p>
            <h2 className="text-sm leading-snug text-brand-black" style={{ fontFamily: "inherit" }}>
              {a.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-none mt-0.5 text-brand-medium-gray hover:text-brand-black transition-colors font-mono text-xs"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Reach */}
          <PanelField
            label={reachUnitLabel}
            sublabel={
              sampleReach != null && ov.reach === undefined
                ? `Auto-filled · ${sampleReach.toLocaleString()} from model`
                : sampleReach != null
                ? `Model: ${sampleReach.toLocaleString()}`
                : undefined
            }
            value={reach}
            onChange={v => setField(a.id, "reach", v)}
            placeholder={sampleReach != null ? String(sampleReach) : "Enter count"}
            isOverridden={ov.reach !== undefined}
            onClear={ov.reach !== undefined ? () => setField(a.id, "reach", null) : undefined}
          />

          {/* Divider */}
          <div className="border-t border-brand-light-gray" />

          {/* MQL Forecast */}
          <PanelField
            label="MQL Forecast"
            sublabel={
              ov.mqlFcst === undefined && autoMqlFcst != null
                ? `Auto-calculated · ${autoMqlFcst.toLocaleString()} from ${reachUnitLabel.toLowerCase()} × rate`
                : ov.mqlFcst === undefined && a.mql != null
                ? `From Asana goal: ${a.mql}`
                : undefined
            }
            value={mqlFcst}
            onChange={v => setField(a.id, "mqlFcst", v)}
            placeholder={autoMqlFcst != null ? String(autoMqlFcst) : a.mql ? String(a.mql) : "Enter forecast"}
            isOverridden={ov.mqlFcst !== undefined}
            onClear={ov.mqlFcst !== undefined ? () => setField(a.id, "mqlFcst", null) : undefined}
          />

          {/* MQL Actual */}
          <PanelField
            label="MQL Actual"
            sublabel={
              ov.mqlActual === undefined && autoMqlActual != null
                ? `Auto-populated from Salesforce · ${autoMqlActual.toLocaleString()} MQLs`
                : "From Salesforce / reported result"
            }
            value={ov.mqlActual !== undefined ? ov.mqlActual : autoMqlActual}
            onChange={v => setField(a.id, "mqlActual", v)}
            placeholder={autoMqlActual != null ? String(autoMqlActual) : "Enter actual"}
            isOverridden={ov.mqlActual !== undefined}
            onClear={ov.mqlActual !== undefined ? () => setField(a.id, "mqlActual", null) : undefined}
          />

          {/* Divider */}
          <div className="border-t border-brand-light-gray" />

          {/* SAO Forecast */}
          <PanelField
            label="SAO Forecast"
            sublabel={
              ov.saoFcst === undefined && autoSaoFcst != null
                ? `Auto-calculated · ${autoSaoFcst.toLocaleString()} from MQL × channel rate`
                : undefined
            }
            value={saoFcst}
            onChange={v => setField(a.id, "saoFcst", v)}
            placeholder={autoSaoFcst != null ? String(autoSaoFcst) : "Enter forecast"}
            isOverridden={ov.saoFcst !== undefined}
            onClear={ov.saoFcst !== undefined ? () => setField(a.id, "saoFcst", null) : undefined}
          />

          {/* SAO Actual */}
          <PanelField
            label="SAO Actual"
            sublabel={
              ov.saoActual === undefined && autoSaoActual != null
                ? `Auto-populated from Salesforce · ${autoSaoActual.toLocaleString()} SAOs`
                : "From Salesforce / reported result"
            }
            value={ov.saoActual !== undefined ? ov.saoActual : autoSaoActual}
            onChange={v => setField(a.id, "saoActual", v)}
            placeholder={autoSaoActual != null ? String(autoSaoActual) : "Enter actual"}
            isOverridden={ov.saoActual !== undefined}
            onClear={ov.saoActual !== undefined ? () => setField(a.id, "saoActual", null) : undefined}
          />

          {/* Divider */}
          <div className="border-t border-brand-light-gray" />

          {/* Notes */}
          <div>
            <label className="block font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest mb-2">
              Notes
            </label>
            <textarea
              value={ov.comment ?? ""}
              onChange={e => setStringField(a.id, "comment", e.target.value || null)}
              rows={3}
              placeholder="Add context, links, or notes…"
              className="w-full text-sm border border-brand-light-gray rounded-sm px-3 py-2 focus:outline-none focus:border-brand-black transition-colors resize-none font-sans text-brand-black placeholder:text-brand-medium-gray"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest mb-2">
              Status
            </label>
            <div className="flex gap-2">
              {(["active", "postponed", "cancelled"] as const).map(s => {
                const current = ov.status ?? "active"
                const isActive = current === s
                const displayVal = s === "active" ? null : s
                return (
                  <button
                    key={s}
                    onClick={() => setStringField(a.id, "status", displayVal)}
                    className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm border transition-colors ${
                      isActive
                        ? s === "cancelled"
                          ? "bg-brand-black text-white border-brand-black"
                          : s === "postponed"
                          ? "bg-amber-400 text-amber-900 border-amber-400"
                          : "bg-brand-lime text-brand-black border-brand-lime"
                        : "bg-transparent text-brand-medium-gray border-brand-light-gray hover:border-brand-medium-gray"
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* SFDC Campaign link */}
          {a.sfdc && (
            <div>
              <label className="block font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest mb-2">
                Salesforce Campaign
              </label>
              <a
                href={`https://exacttarget.lightning.force.com/lightning/r/Campaign/${a.sfdc}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-brand-blue underline break-all"
              >
                {a.sfdc}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-light-gray">
          <button
            onClick={onClose}
            className="w-full font-mono text-[11px] uppercase tracking-widest text-brand-medium-gray border border-brand-light-gray py-2 rounded-sm hover:border-brand-black hover:text-brand-black transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  )
}

function PanelField({
  label,
  sublabel,
  value,
  onChange,
  placeholder,
  isOverridden,
  onClear,
}: {
  label: string
  sublabel?: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  isOverridden: boolean
  onClear?: () => void
}) {
  const [raw, setRaw] = useState(value != null ? String(value) : "")

  // Sync raw when value changes externally (e.g., clear)
  React.useEffect(() => {
    setRaw(value != null ? String(value) : "")
  }, [value])

  function commit(inputVal: string) {
    const cleaned = inputVal.replace(/[^0-9]/g, "")
    onChange(cleaned === "" ? null : parseInt(cleaned, 10))
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest">
          {label}
        </label>
        {onClear && (
          <button
            onClick={onClear}
            className="font-mono text-[9px] text-brand-medium-gray hover:text-brand-hot-red transition-colors uppercase tracking-widest"
          >
            Reset to auto
          </button>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(raw) }}
          placeholder={placeholder}
          className={`w-full font-mono text-sm tabular-nums border rounded-sm px-3 py-2 focus:outline-none transition-colors ${
            isOverridden
              ? "border-brand-black text-brand-black bg-white"
              : "border-brand-light-gray text-brand-black bg-[#FAFAFA] focus:border-brand-black focus:bg-white"
          } placeholder:text-brand-light-gray`}
        />
      </div>
      {sublabel && (
        <p className="font-mono text-[9px] text-brand-medium-gray mt-1">{sublabel}</p>
      )}
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="font-mono text-xs text-brand-medium-gray">±0</span>
  return (
    <span className={`font-mono text-xs ${delta > 0 ? "text-brand-dark-green" : "text-brand-hot-red"}`}>
      {delta > 0 ? "+" : ""}{delta.toLocaleString()}
    </span>
  )
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-4 py-1.5 rounded-full whitespace-nowrap transition-colors font-mono ${
        active
          ? "bg-brand-black text-white"
          : "text-brand-medium-gray hover:bg-brand-light-gray"
      }`}
    >
      {children}
    </button>
  )
}

// ── Calendar view ─────────────────────────────────────────────────────────────

function CalendarView({ activities }: { activities: Activity[] }) {
  const defaultMonth = useMemo(() => {
    const dates = activities.map(a => activityDate(a)).filter(Boolean) as string[]
    return dates.length > 0 ? dates.sort()[0].slice(0, 7) : TODAY.slice(0, 7)
  }, [activities])

  const [month, setMonth] = useState(defaultMonth)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const [yearStr, monthStr] = month.split("-")
  const year = Number(yearStr)
  const monthNum = Number(monthStr)

  const byDay = useMemo(() => {
    const map: Record<string, Activity[]> = {}
    activities.forEach(a => {
      const d = activityDate(a)
      if (d) {
        if (!map[d]) map[d] = []
        map[d].push(a)
      }
    })
    return map
  }, [activities])

  function prevMonth() {
    const d = new Date(year, monthNum - 2, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    setSelectedDay(null)
  }
  function nextMonth() {
    const d = new Date(year, monthNum, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    setSelectedDay(null)
  }

  const startDow = new Date(year, monthNum - 1, 1).getDay()
  const daysInMonth = new Date(year, monthNum, 0).getDate()

  const cells: (string | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const monthPrefix = `${year}-${String(monthNum).padStart(2, "0")}`
  const monthlyEntries = Object.entries(byDay).filter(([d]) => d.startsWith(monthPrefix))
  const monthlyCount = monthlyEntries.reduce((s, [, acts]) => s + acts.length, 0)

  const selectedActivities = selectedDay
    ? (byDay[selectedDay] || []).sort((a, b) => a.name.localeCompare(b.name))
    : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center border border-brand-light-gray hover:border-brand-medium-gray text-brand-medium-gray hover:text-brand-black transition-colors font-mono text-xs"
          >
            ←
          </button>
          <span className="font-mono text-sm text-brand-black w-40 text-center">
            {MONTHS_FULL[monthNum - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center border border-brand-light-gray hover:border-brand-medium-gray text-brand-medium-gray hover:text-brand-black transition-colors font-mono text-xs"
          >
            →
          </button>
        </div>
        <div className="flex gap-6 font-mono text-xs text-brand-medium-gray">
          <span><span className="text-brand-black">{monthlyCount}</span> activities this month</span>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {DOW.map(d => (
          <div
            key={d}
            className="font-mono text-xs text-brand-medium-gray text-center py-2 bg-[#FAFAFA] border-t border-l border-brand-light-gray last:border-r"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const count = day ? (byDay[day]?.length || 0) : 0
          const isToday = day === TODAY
          const isSelected = day === selectedDay
          const hasActs = count > 0
          const col = i % 7

          return (
            <div
              key={i}
              onClick={() => day && hasActs && setSelectedDay(isSelected ? null : day)}
              className={[
                "border-b border-r border-brand-light-gray min-h-[76px] p-2",
                col === 0 ? "border-l" : "",
                !day ? "bg-[#FAFAFA]" : "",
                hasActs && !isSelected ? "cursor-pointer hover:bg-[#FAFAFA]" : "",
                isSelected ? "bg-brand-lime" : "",
              ].filter(Boolean).join(" ")}
            >
              {day && (
                <>
                  <div className={[
                    "font-mono text-xs mb-2 w-5 h-5 flex items-center justify-center",
                    isToday ? "bg-brand-black text-white rounded-full" : "text-brand-medium-gray",
                  ].join(" ")}>
                    {Number(day.slice(8))}
                  </div>
                  {count > 0 && (
                    <div className={[
                      "inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-mono",
                      isSelected ? "bg-brand-black text-white" : "bg-brand-lime text-brand-black",
                    ].join(" ")}>
                      {count}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {selectedDay && (
        <div className="mt-4 border border-brand-black bg-white">
          <div className="px-5 py-3 border-b border-brand-light-gray flex items-center justify-between">
            <span className="font-mono text-xs text-brand-medium-gray">
              {selectedDay} — {selectedActivities.length} {selectedActivities.length === 1 ? "activity" : "activities"}
            </span>
            <button
              onClick={() => setSelectedDay(null)}
              className="font-mono text-xs text-brand-medium-gray hover:text-brand-black"
            >
              close ×
            </button>
          </div>
          {selectedActivities.map(a => {
            const reg = regionDisplay(a.region)
            return (
              <div key={a.id} className="px-5 py-3 border-b border-brand-light-gray last:border-b-0 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://app.asana.com/0/0/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm leading-snug hover:underline"
                  >
                    {a.name}
                  </a>
                  <div className="flex flex-wrap gap-2 mt-1 font-mono text-xs text-brand-medium-gray">
                    {reg && <span>{reg.flag} {reg.text}</span>}
                    {a.channel && <span>· {a.channel}</span>}
                    {a.owner && <span>· {a.owner}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {monthlyCount === 0 && (
        <div className="mt-4 px-6 py-12 text-center font-mono text-xs text-brand-medium-gray border border-brand-light-gray">
          No activities in {MONTHS_FULL[monthNum - 1]} {year} match the current filters.
        </div>
      )}
    </div>
  )
}

// ── CommentCell ───────────────────────────────────────────────────────────────

function CommentCell({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  const [draft, setDraft] = useState(value ?? "")
  return (
    <textarea
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onChange(draft.trim() || null)}
      rows={2}
      placeholder="Add a note…"
      className="w-full text-xs font-mono border border-brand-light-gray focus:border-brand-black focus:outline-none px-2.5 py-2 resize-none text-brand-black placeholder:text-brand-medium-gray bg-white leading-relaxed"
    />
  )
}

// ── List view ─────────────────────────────────────────────────────────────────

const TABLE_MIN_W = 1640

function ListView({
  activities,
  quarterFilter,
  overrides,
  setField,
  setStringField,
  onEdit,
}: {
  activities: Activity[]
  quarterFilter: string
  overrides: OverridesMap
  setField: (id: string, field: keyof Pick<ActivityOverride, "reach" | "mqlFcst" | "saoFcst" | "mqlActual" | "saoActual">, value: number | null) => void
  setStringField: (id: string, field: keyof Pick<ActivityOverride, "status" | "comment">, value: string | null) => void
  onEdit: (a: Activity) => void
}) {
  const topRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const isSyncing = useRef(false)

  const onTopScroll = () => {
    if (isSyncing.current) return
    if (mainRef.current && topRef.current) {
      isSyncing.current = true
      mainRef.current.scrollLeft = topRef.current.scrollLeft
      requestAnimationFrame(() => { isSyncing.current = false })
    }
  }

  const onMainScroll = () => {
    if (isSyncing.current) return
    if (mainRef.current && topRef.current) {
      isSyncing.current = true
      topRef.current.scrollLeft = mainRef.current.scrollLeft
      requestAnimationFrame(() => { isSyncing.current = false })
    }
  }

  return (
    <div>
      {/* Top phantom scrollbar */}
      <div
        ref={topRef}
        onScroll={onTopScroll}
        className="overflow-x-auto"
        style={{ height: 12 }}
      >
        <div style={{ width: TABLE_MIN_W, height: 1 }} />
      </div>
      {/* Main scrollable table */}
      <div ref={mainRef} onScroll={onMainScroll} className="overflow-x-auto">
      <table className="w-full" style={{ minWidth: TABLE_MIN_W }}>
        <thead>
          <tr className="border-b border-brand-black bg-[#FAFAFA]">
            <th className="px-3 py-3 w-8" />
            <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-4 py-3 w-14">Status</th>
            <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3">Activity</th>
            <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap">Date</th>
            <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3">Region</th>
            <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3">Channel</th>
            <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap">SFDC Campaign</th>
            <th
              className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap"
              title="How MQL forecast was derived: Override (user), Reach × rate (auto), Asana goal, or no method"
            >
              Fcst method
            </th>
            <th
              className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap"
              title="Whether this activity qualifies for automated forecasting"
            >
              Fcst eligibility
            </th>
            <th
              className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap"
              title="Whether this activity has a Salesforce Campaign ID"
            >
              SF linkage
            </th>
            <th
              className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap"
              title="How actuals are sourced: certified from SFDC or manual entry only"
            >
              Actuals src
            </th>
            <th
              className="text-right font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap"
              title="Reach (registrants / attendees / recipients) · from Hex or manual override"
            >
              Reach ✎
            </th>
            <th className="text-right font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap">MQL fcst ✎</th>
            <th className="text-right font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap">MQL actual ✎</th>
            <th className="text-right font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3">Δ MQL</th>
            <th className="text-right font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap">SAO fcst ✎</th>
            <th className="text-right font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap">SAO actual ✎</th>
            <th
              className="text-right font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 whitespace-nowrap"
              title="Channel MQL-to-SAO conversion rate benchmark from historical data · period set above"
            >
              MQL→SAO rate
            </th>
            <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3">Owner</th>
            <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-3 min-w-[180px]">Notes</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => {
            const d = activityDate(a)
            const isExact = !!a.due
            const regions = salesRegionsOf(a)
            const isGlobal = regions.length === SALES_REGIONS.length

            const ov = overrides[a.id] ?? {}
            const status = ov.status ?? null
            const isCancelled = status === "cancelled"
            const isPostponed = status === "postponed"

            // Reach: user override > sample (from Hex in prod) > null
            const sampleReach = SAMPLE_REACH[a.id] ?? null
            const reach: number | null = ov.reach !== undefined ? ov.reach : sampleReach
            const reachIsOverridden = ov.reach !== undefined
            const reachIsSample = !reachIsOverridden && sampleReach != null

            // MQL fcst: user override > auto (reach × channel rate) > Asana mql > null
            const channelRate = a.channel ? getChannelRate(a.channel) : undefined
            const autoMqlFcst: number | null =
              reach != null && a.channel ? calcMqlFcst(reach, a.channel) : null
            const mqlFcst: number | null =
              ov.mqlFcst !== undefined ? ov.mqlFcst
              : autoMqlFcst ?? (a.mql ?? null)
            const mqlFcstIsAuto = ov.mqlFcst === undefined && autoMqlFcst != null

            // SAO fcst: user override > auto (MQL fcst × channel MQL→SAO rate) > null
            const benchmark = a.channel
              ? lookupActuals(quarterFilter, "Campaign channel", a.channel)
              : null
            const autoSaoFcst: number | null =
              mqlFcst != null && benchmark != null
                ? Math.round(mqlFcst * benchmark.conversionRate)
                : null
            const saoFcst: number | null =
              ov.saoFcst !== undefined ? ov.saoFcst : autoSaoFcst
            const saoFcstIsAuto = ov.saoFcst === undefined && autoSaoFcst != null

            // Actuals: user override > SFDC certified (via campaign ID) > null
            const sfdcActuals = lookupSfdcActuals(a.sfdc, quarterFilter)
            const mqlActual: number | null = ov.mqlActual !== undefined ? ov.mqlActual : (sfdcActuals?.mql ?? null)
            const saoActual: number | null = ov.saoActual !== undefined ? ov.saoActual : (sfdcActuals?.sao ?? null)
            const delta = mqlFcst != null && mqlActual != null ? mqlActual - mqlFcst : null

            const convRate = benchmark != null
              ? (benchmark.conversionRate * 100).toFixed(1) + "%"
              : null

            const hasNoFcst = mqlFcst == null && !isCancelled

            const regionLabel = isGlobal
              ? "Global"
              : regions.length > 0
              ? regions[0] + (regions.length > 1 ? ` +${regions.length - 1}` : "")
              : null
            const regionFlag = regions.length > 0 ? REGION_FLAGS[regions[0]] : ""

            const cycleStatus = () => {
              const next =
                status === null ? "postponed"
                : status === "postponed" ? "cancelled"
                : null
              setStringField(a.id, "status", next)
            }

            const rowBg = isCancelled
              ? "border-gray-200 bg-gray-50 hover:bg-gray-100"
              : isPostponed
              ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
              : hasNoFcst
              ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
              : "border-brand-light-gray hover:bg-[#FAFAFA]"

            return (
              <tr
                key={a.id}
                className={`border-b transition-colors ${rowBg}`}
              >
                {/* Edit button */}
                <td className="px-2 py-4 align-middle">
                  <button
                    onClick={() => onEdit(a)}
                    title="Edit forecasts & actuals"
                    className="w-6 h-6 flex items-center justify-center rounded-sm text-brand-medium-gray hover:text-brand-black hover:bg-brand-light-gray transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </button>
                </td>
                {/* Status badge — click to cycle active → postponed → cancelled → active */}
                <td className="px-4 py-4 align-middle">
                  <button
                    onClick={cycleStatus}
                    title={
                      status === null ? "Mark postponed"
                      : status === "postponed" ? "Mark cancelled"
                      : "Clear status"
                    }
                    className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border transition-colors cursor-pointer ${
                      isCancelled
                        ? "bg-gray-200 text-gray-500 border-gray-300"
                        : isPostponed
                        ? "bg-amber-200 text-amber-800 border-amber-300"
                        : "bg-transparent text-brand-medium-gray border-brand-light-gray hover:border-brand-medium-gray"
                    }`}
                  >
                    {isCancelled ? "CXL" : isPostponed ? "PST" : "ACT"}
                  </button>
                </td>

                {/* Activity name + section + SFDC tag */}
                <td className="px-3 py-4 align-middle" style={{ maxWidth: "22rem" }}>
                  <a
                    href={`https://app.asana.com/0/0/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-sm leading-snug hover:underline block ${isCancelled ? "line-through text-brand-medium-gray" : ""}`}
                    title={a.name}
                  >
                    {a.name}
                  </a>
                  {a.section && (
                    <span className="block font-mono text-[10px] text-brand-medium-gray mt-0.5 truncate">
                      {a.section}
                    </span>
                  )}
                </td>

                {/* Date */}
                <td className="px-3 py-4 align-middle whitespace-nowrap">
                  {d ? (
                    <>
                      <span className={`font-mono text-xs ${isExact ? "text-brand-black" : "text-brand-medium-gray"}`}>
                        {fmtShort(d)}
                      </span>
                      <span className="block font-mono text-[10px] text-brand-medium-gray mt-0.5">
                        {fmtMonthYear(d)}
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-brand-medium-gray">—</span>
                  )}
                </td>

                {/* Region + subRegion */}
                <td className="px-3 py-4 font-mono text-xs align-middle whitespace-nowrap">
                  {regionLabel ? (
                    <>
                      <span className={isGlobal ? "text-brand-medium-gray" : "text-brand-black"}>
                        {!isGlobal && regionFlag && <span className="mr-0.5">{regionFlag}</span>}
                        {regionLabel}
                      </span>
                      {a.subRegion ? (
                        <span className="block text-[10px] text-brand-medium-gray mt-0.5">{a.subRegion}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-brand-medium-gray">—</span>
                  )}
                </td>

                {/* Channel */}
                <td className="px-3 py-4 font-mono text-xs align-middle">
                  {a.channel ? (
                    <span className="text-brand-black">{a.channel}</span>
                  ) : (
                    <span className="text-brand-medium-gray">—</span>
                  )}
                </td>

                {/* SFDC Campaign */}
                <td className="px-3 py-4 align-middle">
                  {a.sfdc ? (
                    <span className="inline-block font-mono text-[9px] text-brand-medium-gray bg-[#F0F0F0] border border-brand-light-gray px-1.5 py-0.5 rounded-sm tracking-wide whitespace-nowrap">
                      {a.sfdc}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-brand-light-gray">—</span>
                  )}
                </td>

                {/* Forecast method */}
                <td className="px-3 py-4 align-middle whitespace-nowrap">
                  {isCancelled ? (
                    <span className="font-mono text-[10px] text-brand-light-gray">—</span>
                  ) : ov.mqlFcst !== undefined ? (
                    <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm">Override</span>
                  ) : autoMqlFcst != null ? (
                    <span className="font-mono text-[10px] text-brand-black bg-[#F0F0F0] border border-brand-light-gray px-1.5 py-0.5 rounded-sm">Reach × rate</span>
                  ) : a.mql != null ? (
                    <span className="font-mono text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm">Asana goal</span>
                  ) : (
                    <span className="font-mono text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm">No method</span>
                  )}
                </td>

                {/* Forecast eligibility */}
                <td className="px-3 py-4 align-middle whitespace-nowrap">
                  {isCancelled ? (
                    <span className="font-mono text-[10px] text-brand-light-gray">—</span>
                  ) : !a.channel ? (
                    <span className="font-mono text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm">No channel</span>
                  ) : reach == null ? (
                    <span className="font-mono text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm">No reach</span>
                  ) : (
                    <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm">Eligible</span>
                  )}
                </td>

                {/* SF linkage */}
                <td className="px-3 py-4 align-middle whitespace-nowrap">
                  {a.sfdc ? (
                    <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm">Linked</span>
                  ) : (
                    <span className="font-mono text-[10px] text-brand-medium-gray bg-[#F7F7F5] border border-brand-light-gray px-1.5 py-0.5 rounded-sm">Unlinked</span>
                  )}
                </td>

                {/* Actuals source */}
                <td className="px-3 py-4 align-middle whitespace-nowrap">
                  {a.sfdc && sfdcActuals != null ? (
                    <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm">SFDC</span>
                  ) : a.sfdc ? (
                    <span className="font-mono text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm">SFDC / pending</span>
                  ) : (
                    <span className="font-mono text-[10px] text-brand-medium-gray bg-[#F7F7F5] border border-brand-light-gray px-1.5 py-0.5 rounded-sm">Manual only</span>
                  )}
                </td>

                {/* Reach — editable, auto-filled from SAMPLE_REACH */}
                <td className="px-3 py-4 align-middle min-w-[5rem]">
                  <EditableNum
                    value={reach}
                    onChange={v => setField(a.id, "reach", v)}
                    computed={reachIsSample}
                    sublabel={
                      reachIsSample
                        ? channelRate?.reachUnit ?? "reach"
                        : reachIsOverridden
                        ? channelRate?.reachUnit ?? undefined
                        : undefined
                    }
                  />
                </td>

                {/* MQL fcst — editable, auto-calculated from reach × rate */}
                <td className="px-3 py-4 align-middle min-w-[5rem]">
                  <EditableNum
                    value={mqlFcst}
                    onChange={v => setField(a.id, "mqlFcst", v)}
                    computed={mqlFcstIsAuto}
                    sublabel={mqlFcstIsAuto ? "calc" : undefined}
                  />
                </td>

                {/* MQL actual — editable */}
                <td className="px-3 py-4 align-middle min-w-[5rem]">
                  <EditableNum
                    value={mqlActual}
                    onChange={v => setField(a.id, "mqlActual", v)}
                  />
                </td>

                {/* Δ MQL */}
                <td className="px-3 py-4 text-right align-middle">
                  {delta != null ? (
                    <DeltaBadge delta={delta} />
                  ) : (
                    <span className="font-mono text-xs text-brand-medium-gray">—</span>
                  )}
                </td>

                {/* SAO fcst — editable, auto-calculated from MQL fcst × ch. rate */}
                <td className="px-3 py-4 align-middle min-w-[5rem]">
                  <EditableNum
                    value={saoFcst}
                    onChange={v => setField(a.id, "saoFcst", v)}
                    computed={saoFcstIsAuto}
                    sublabel={saoFcstIsAuto ? "calc" : undefined}
                  />
                </td>

                {/* SAO actual — editable */}
                <td className="px-3 py-4 align-middle min-w-[5rem]">
                  <EditableNum
                    value={saoActual}
                    onChange={v => setField(a.id, "saoActual", v)}
                  />
                </td>

                {/* Channel benchmark conversion rate (read-only reference) */}
                <td className="px-3 py-4 text-right align-middle">
                  {convRate != null ? (
                    <span className="font-mono text-xs text-brand-medium-gray">
                      {convRate}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-brand-medium-gray">—</span>
                  )}
                </td>

                {/* Owner */}
                <td className="px-3 py-4 font-mono text-xs align-middle whitespace-nowrap">
                  {a.owner ? (
                    <span className="text-brand-black">{a.owner}</span>
                  ) : (
                    <span className="text-brand-medium-gray">—</span>
                  )}
                </td>

                {/* Notes — persisted to the shared Payload workspace */}
                <td className="px-3 py-2 align-middle min-w-[180px]">
                  <CommentCell
                    value={ov.comment ?? null}
                    onChange={v => setStringField(a.id, "comment", v)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {activities.length === 0 && (
        <div className="px-6 py-12 text-center font-mono text-xs text-brand-medium-gray">
          No activities match the current filters.
        </div>
      )}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function ActivitiesView() {
  const asana = useLiveAsana()
  const activities = asana.data?.activities ?? []
  const [view, setView] = useState<"list" | "calendar">("list")
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [regionFilter, setRegionFilter] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<string | null>(null)
  const [languageFilter, setLanguageFilter] = useState<string | null>(null)
  const [productFilter, setProductFilter] = useState<string | null>(null)
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null)
  const [quarterFilter, setQuarterFilter] = useState<string>("2026-07-01")
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)

  const { overrides, setField, setStringField } = useActivityOverrides()

  const ahead = useMemo(
    () => activities.filter(a => { const d = activityDate(a); return !!d && d >= TODAY }),
    [activities]
  )

  const allOwners = useMemo(
    () => [...new Set(ahead.map(a => a.owner).filter(Boolean) as string[])].sort(),
    [ahead]
  )

  const dateFiltered = useMemo(
    () => applyDateFilter(ahead, dateFilter, fromDate, toDate),
    [ahead, dateFilter, fromDate, toDate]
  )

  const regionChannelFiltered = useMemo(() => {
    return dateFiltered.filter(a => {
      if (regionFilter && !salesRegionsOf(a).includes(regionFilter)) return false
      if (channelFilter !== null) {
        if (channelFilter === "__none__" && a.channel) return false
        if (channelFilter !== "__none__" && a.channel !== channelFilter) return false
      }
      return true
    })
  }, [dateFiltered, regionFilter, channelFilter])

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    dateFiltered
      .filter(a => !regionFilter || salesRegionsOf(a).includes(regionFilter))
      .filter(a => !ownerFilter || a.owner === ownerFilter)
      .forEach(a => {
        const key = a.channel || "__none__"
        counts[key] = (counts[key] || 0) + 1
      })
    return counts
  }, [dateFiltered, regionFilter, ownerFilter])

  const languageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    regionChannelFiltered.forEach(a => {
      if (a.language) counts[a.language] = (counts[a.language] || 0) + 1
    })
    return counts
  }, [regionChannelFiltered])

  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    regionChannelFiltered.forEach(a => {
      if (a.product) counts[a.product] = (counts[a.product] || 0) + 1
    })
    return counts
  }, [regionChannelFiltered])

  const filtered = useMemo(() => {
    return regionChannelFiltered
      .filter(a => {
        if (languageFilter && a.language !== languageFilter) return false
        if (productFilter && a.product !== productFilter) return false
        if (ownerFilter && a.owner !== ownerFilter) return false
        return true
      })
      .sort((x, y) => {
        const dx = activityDate(x) || "9999"
        const dy = activityDate(y) || "9999"
        return dx.localeCompare(dy) || x.name.localeCompare(y.name)
      })
  }, [regionChannelFiltered, languageFilter, productFilter, ownerFilter])

  const mqlFcstFilled = useMemo(
    () => filtered.filter(a => {
      const ov = overrides[a.id]
      if (ov?.mqlFcst !== undefined) return ov.mqlFcst != null
      const sampleReach = SAMPLE_REACH[a.id] ?? null
      const reach = sampleReach
      const autoMql = reach != null && a.channel ? calcMqlFcst(reach, a.channel) : null
      return (autoMql ?? a.mql) != null
    }).length,
    [filtered, overrides]
  )

  const mqlActualFilled = useMemo(
    () => filtered.filter(a => {
      const ov = overrides[a.id]
      if (ov?.mqlActual != null) return true
      return lookupSfdcActuals(a.sfdc, quarterFilter) != null
    }).length,
    [filtered, overrides, quarterFilter]
  )

  const forecastRollup = useMemo(() => {
    let totalMql = 0
    let totalSao = 0
    let covered = 0
    let gaps = 0
    for (const a of filtered) {
      const ov = overrides[a.id] ?? {}
      if (ov.status === "cancelled") continue
      const sampleReach = SAMPLE_REACH[a.id] ?? null
      const reach = ov.reach !== undefined ? ov.reach : sampleReach
      const autoMql = reach != null && a.channel ? calcMqlFcst(reach, a.channel) : null
      const mqlFcst = ov.mqlFcst !== undefined ? ov.mqlFcst : autoMql ?? (a.mql ?? null)
      const benchmark = a.channel
        ? lookupActuals(quarterFilter, "Campaign channel", a.channel)
        : null
      const autoSao = mqlFcst != null && benchmark != null
        ? Math.round(mqlFcst * benchmark.conversionRate)
        : null
      const saoFcst = ov.saoFcst !== undefined ? ov.saoFcst : autoSao
      if (mqlFcst != null) {
        covered++
        totalMql += mqlFcst
      } else {
        gaps++
      }
      if (saoFcst != null) totalSao += saoFcst
    }
    return { totalMql, totalSao, covered, gaps, total: filtered.length }
  }, [filtered, overrides, quarterFilter])

  const regionRollup = useMemo(() => {
    const rows: Record<string, {
      mqlFcst: number; saoFcst: number; count: number; covered: number; gaps: number;
      confidence: { high: number; medium: number; low: number };
      subRegions: Record<string, { mqlFcst: number; saoFcst: number; count: number; covered: number; gaps: number }>
    }> = {}
    for (const region of SALES_REGIONS) {
      rows[region] = { mqlFcst: 0, saoFcst: 0, count: 0, covered: 0, gaps: 0, confidence: { high: 0, medium: 0, low: 0 }, subRegions: {} }
    }
    for (const a of filtered) {
      const ov = overrides[a.id] ?? {}
      if (ov.status === "cancelled") continue
      const regions = salesRegionsOf(a)
      if (regions.length === 0) continue
      const sampleReach = SAMPLE_REACH[a.id] ?? null
      const reach = ov.reach !== undefined ? ov.reach : sampleReach
      const autoMql = reach != null && a.channel ? calcMqlFcst(reach, a.channel) : null
      const mqlFcst = ov.mqlFcst !== undefined ? ov.mqlFcst : autoMql ?? (a.mql ?? null)
      const benchmark = a.channel ? lookupActuals(quarterFilter, "Campaign channel", a.channel) : null
      const autoSao = mqlFcst != null && benchmark != null ? Math.round(mqlFcst * benchmark.conversionRate) : null
      const saoFcst = ov.saoFcst !== undefined ? ov.saoFcst : autoSao
      const conf = calcActivityConfidence(a, ov)
      // Distribute evenly across assigned regions
      const share = 1 / regions.length
      for (const region of regions) {
        if (!rows[region]) rows[region] = { mqlFcst: 0, saoFcst: 0, count: 0, covered: 0, gaps: 0, confidence: { high: 0, medium: 0, low: 0 }, subRegions: {} }
        const row = rows[region]
        row.count++
        row.confidence[conf]++
        if (mqlFcst != null) { row.mqlFcst += mqlFcst * share; row.covered++ }
        else row.gaps++
        if (saoFcst != null) row.saoFcst += saoFcst * share
        // Sub-region breakdown
        const sub = a.subRegion || null
        if (sub) {
          if (!row.subRegions[sub]) row.subRegions[sub] = { mqlFcst: 0, saoFcst: 0, count: 0, covered: 0, gaps: 0 }
          const sr = row.subRegions[sub]
          sr.count++
          if (mqlFcst != null) { sr.mqlFcst += mqlFcst * share; sr.covered++ }
          else sr.gaps++
          if (saoFcst != null) sr.saoFcst += saoFcst * share
        }
      }
    }
    return rows
  }, [filtered, overrides, quarterFilter])

  const noChannelCount = channelCounts["__none__"] || 0
  const channelEntries = Object.entries(channelCounts)
    .filter(([ch]) => ch !== "__none__")
    .sort((a, b) => b[1] - a[1])

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl tracking-tight mb-1">The activity behind it</h1>
          <p className="text-brand-medium-gray text-xs font-mono">
            {asana.status === "live"
              ? `${activities.length} live activities · fetched ${asana.data!.fetchedAt.slice(0, 10)} · 1 board connected`
              : `Live Asana ${asana.status} · ${asana.detail ?? "waiting for source"}`}
          </p>
        </div>
        {/* View toggle inline with header */}
        <div className="flex items-center gap-1 shrink-0 mb-0.5">
          <button
            onClick={() => setView("list")}
            className={`font-mono text-xs px-3 py-1.5 border transition-colors ${view === "list" ? "bg-brand-black text-white border-brand-black" : "bg-white text-brand-medium-gray border-brand-light-gray hover:border-brand-black"}`}
          >
            List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`font-mono text-xs px-3 py-1.5 border transition-colors ${view === "calendar" ? "bg-brand-black text-white border-brand-black" : "bg-white text-brand-medium-gray border-brand-light-gray hover:border-brand-black"}`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* ── Compact filter toolbar ───────────────────────────────────────────── */}
      <div className="border border-brand-light-gray bg-white mb-6">

        {/* Row 1: Date · Region · Channel */}
        <div className="flex items-center gap-0 border-b border-brand-light-gray divide-x divide-brand-light-gray">

          {/* Date quick-pick */}
          <div className="flex items-center gap-1.5 px-3 py-2.5 shrink-0">
            <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray mr-1 whitespace-nowrap">Date</span>
            {DATE_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                className={`font-mono text-[11px] px-2 py-1 whitespace-nowrap transition-colors ${dateFilter === tab.id ? "bg-brand-black text-white" : "text-brand-medium-gray hover:text-brand-black"}`}
              >
                {tab.label}
              </button>
            ))}
            <span className="font-mono text-[10px] text-brand-medium-gray ml-1 whitespace-nowrap">from</span>
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setDateFilter("custom") }}
              className="font-mono text-[11px] border border-brand-light-gray px-2 py-1 text-brand-medium-gray focus:outline-none focus:border-brand-black bg-white w-32"
            />
            <span className="font-mono text-[10px] text-brand-medium-gray">to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setDateFilter("custom") }}
              className="font-mono text-[11px] border border-brand-light-gray px-2 py-1 text-brand-medium-gray focus:outline-none focus:border-brand-black bg-white w-32"
            />
          </div>
        </div>

        {/* Row 2: Region · Channel · Owner · Rate ref */}
        <div className="flex items-center gap-0 divide-x divide-brand-light-gray flex-wrap">

          {/* Region */}
          <div className="flex items-center gap-1.5 px-3 py-2.5 shrink-0">
            <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray mr-1 whitespace-nowrap">Region</span>
            <button
              onClick={() => setRegionFilter(null)}
              className={`font-mono text-[11px] px-2 py-1 whitespace-nowrap transition-colors ${regionFilter === null ? "bg-brand-black text-white" : "text-brand-medium-gray hover:text-brand-black"}`}
            >All</button>
            {SALES_REGIONS.map(r => (
              <button
                key={r}
                onClick={() => setRegionFilter(regionFilter === r ? null : r)}
                className={`font-mono text-[11px] px-2 py-1 whitespace-nowrap transition-colors ${regionFilter === r ? "bg-brand-black text-white" : "text-brand-medium-gray hover:text-brand-black"}`}
              >{r}</button>
            ))}
          </div>

          {/* Channel */}
          <div className="flex items-center gap-1.5 px-3 py-2.5 shrink-0 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray mr-1 whitespace-nowrap">Channel</span>
            <button
              onClick={() => setChannelFilter(null)}
              className={`font-mono text-[11px] px-2 py-1 whitespace-nowrap transition-colors ${channelFilter === null ? "bg-brand-black text-white" : "text-brand-medium-gray hover:text-brand-black"}`}
            >All</button>
            {channelEntries.map(([ch, n]) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(channelFilter === ch ? null : ch)}
                className={`font-mono text-[11px] px-2 py-1 whitespace-nowrap transition-colors ${channelFilter === ch ? "bg-brand-black text-white" : "text-brand-medium-gray hover:text-brand-black"}`}
              >
                {ch} <span className="opacity-50">{n}</span>
              </button>
            ))}
            {noChannelCount > 0 && (
              <button
                onClick={() => setChannelFilter(channelFilter === "__none__" ? null : "__none__")}
                className={`font-mono text-[11px] px-2 py-1 whitespace-nowrap transition-colors ${channelFilter === "__none__" ? "bg-brand-black text-white" : "text-brand-medium-gray hover:text-brand-black"}`}
              >
                — <span className="opacity-50">{noChannelCount}</span>
              </button>
            )}
          </div>

          {/* Owner — compact select */}
          {allOwners.length >= 1 && (
            <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray whitespace-nowrap">Owner</span>
              <select
                value={ownerFilter ?? ""}
                onChange={e => setOwnerFilter(e.target.value || null)}
                className="font-mono text-[11px] border border-brand-light-gray px-2 py-1 text-brand-medium-gray focus:outline-none focus:border-brand-black bg-white appearance-none pr-6 cursor-pointer"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236D6E6D' stroke-width='1.2'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
              >
                <option value="">All owners</option>
                {allOwners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {/* Language — only when multiple */}
          {Object.keys(languageCounts).length >= 2 && (
            <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray whitespace-nowrap">Lang</span>
              <select
                value={languageFilter ?? ""}
                onChange={e => setLanguageFilter(e.target.value || null)}
                className="font-mono text-[11px] border border-brand-light-gray px-2 py-1 text-brand-medium-gray focus:outline-none focus:border-brand-black bg-white appearance-none pr-6 cursor-pointer"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236D6E6D' stroke-width='1.2'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
              >
                <option value="">All languages</option>
                {Object.entries(languageCounts).sort((a,b) => b[1]-a[1]).map(([l,n]) => <option key={l} value={l}>{l} ({n})</option>)}
              </select>
            </div>
          )}

          {/* Product — only when multiple */}
          {Object.keys(productCounts).length >= 2 && (
            <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray whitespace-nowrap">Product</span>
              <select
                value={productFilter ?? ""}
                onChange={e => setProductFilter(e.target.value || null)}
                className="font-mono text-[11px] border border-brand-light-gray px-2 py-1 text-brand-medium-gray focus:outline-none focus:border-brand-black bg-white appearance-none pr-6 cursor-pointer"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236D6E6D' stroke-width='1.2'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
              >
                <option value="">All products</option>
                {Object.entries(productCounts).sort((a,b) => b[1]-a[1]).map(([p,n]) => <option key={p} value={p}>{p} ({n})</option>)}
              </select>
            </div>
          )}

          {/* Rate ref — list view only, far right */}
          {view === "list" && (
            <div className="flex items-center gap-2 px-3 py-2.5 ml-auto shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray whitespace-nowrap">Rate ref</span>
              {ACTUALS_QUARTERS.map(q => (
                <button
                  key={q.value}
                  onClick={() => setQuarterFilter(q.value)}
                  className={`font-mono text-[11px] px-2 py-1 whitespace-nowrap transition-colors ${quarterFilter === q.value ? "bg-brand-black text-white" : "text-brand-medium-gray hover:text-brand-black"}`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter summary strip */}
        {(regionFilter || channelFilter || ownerFilter || languageFilter || productFilter || dateFilter !== "all") && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-[#FAFAFA] border-t border-brand-light-gray">
            <span className="font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest">Filtered:</span>
            <span className="font-mono text-[11px] text-brand-black tabular-nums">{filtered.length} of {ahead.length} activities</span>
            <button
              onClick={() => {
                setDateFilter("all"); setFromDate(""); setToDate("")
                setRegionFilter(null); setChannelFilter(null)
                setOwnerFilter(null); setLanguageFilter(null); setProductFilter(null)
              }}
              className="ml-auto font-mono text-[10px] text-brand-medium-gray hover:text-brand-hot-red transition-colors uppercase tracking-widest"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Forecast data model panel */}
      {view === "list" && (
        <div className="border border-brand-black border-b-0 mt-2 bg-[#F7F7F5]">
          {/* Rollup strip */}
          <div className="px-5 py-3 flex items-center gap-8 flex-wrap border-b border-brand-light-gray">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray block mb-0.5">Est. MQL forecast</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xl tabular-nums text-brand-black">
                  {forecastRollup.totalMql.toLocaleString()}
                </span>
                <span className="font-mono text-xs text-brand-medium-gray">MQLs from {forecastRollup.covered} activities</span>
                {forecastRollup.gaps > 0 && (
                  <span className="font-mono text-xs text-amber-600">· {forecastRollup.gaps} without forecast</span>
                )}
              </div>
            </div>
            <div className="h-8 w-px bg-brand-light-gray hidden sm:block" />
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray block mb-0.5">Est. SAO forecast</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xl tabular-nums text-brand-black">
                  {forecastRollup.totalSao.toLocaleString()}
                </span>
                <span className="font-mono text-xs text-brand-medium-gray">SAOs (via {quarterFilter} ch. rates)</span>
              </div>
            </div>
            <div className="ml-auto font-mono text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-sm whitespace-nowrap">
              ⚠ All values are estimates — not connected to Hex
            </div>
          </div>
          {/* Data model legend */}
          <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray block mb-1">MQL→SAO rate</span>
              <p className="font-mono text-[11px] text-brand-medium-gray leading-snug">
                Historical CSV aggregates by channel and quarter. Rate ref selector above sets the benchmark period.
              </p>
              <span className="font-mono text-[10px] text-brand-medium-gray mt-1 block">✓ Sourced from CSV ({quarterFilter})</span>
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray block mb-1">Actuals source</span>
              <p className="font-mono text-[11px] text-brand-medium-gray leading-snug">
                SFDC Campaign ID flows from Asana — 106 of 286 activities tagged. Opportunity attribution can be pulled via Hex using the campaign ID as the join key.
              </p>
              <span className="font-mono text-[10px] text-brand-dark-green mt-1 block">✓ Asana → SFDC Campaign ID linked · attribution query pending</span>
            </div>
          </div>
        </div>
      )}

      {/* Forecast vs Targets */}
      {view === "list" && (
        <div className="border border-brand-black border-t-0 bg-white">
          <div className="px-5 py-2.5 border-b border-brand-light-gray flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Forecast vs Targets · by region</span>
            <span className="font-mono text-[10px] text-brand-medium-gray">· multi-region activities distributed proportionally · cancelled excluded</span>
            <span className="font-mono text-[10px] text-brand-medium-gray ml-auto">reference: FY26 Q-avg (Q1–Q3)</span>
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-brand-light-gray bg-[#FAFAFA]">
                <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-5 py-2 w-28">Region</th>
                <th className="text-center font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-2">Confidence</th>
                <th className="text-right font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-2">Fcst MQL</th>
                <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-2 w-40">vs FY26 ref</th>
                <th className="text-right font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-2">Fcst SAO</th>
                <th className="text-left font-mono text-[10px] text-brand-medium-gray uppercase tracking-widest px-3 py-2 pr-5 w-40">vs FY26 ref</th>
              </tr>
            </thead>
            <tbody>
              {SALES_REGIONS.map(region => {
                const row = regionRollup[region]
                if (!row || row.count === 0) return null
                const ref = FY26_REGION_REF[region]
                const mqlPct = ref && row.covered > 0 ? Math.round((row.mqlFcst / ref.mql) * 100) : null
                const saoPct = ref && row.covered > 0 && row.saoFcst > 0 ? Math.round((row.saoFcst / ref.sao) * 100) : null
                const subEntries = Object.entries(row.subRegions).sort((a, b) => b[1].mqlFcst - a[1].mqlFcst)
                const totalConf = row.confidence.high + row.confidence.medium + row.confidence.low
                return (
                  <React.Fragment key={region}>
                    <tr className="border-b border-brand-light-gray hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-5 py-2.5 font-mono text-xs text-brand-black">
                        <span className="mr-1.5">{REGION_FLAGS[region] || ""}</span>
                        {region}
                        <span className="text-brand-medium-gray text-[10px] ml-1.5">({row.count})</span>
                      </td>
                      {/* Confidence dots */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {row.confidence.high > 0 && (
                            <span className="flex items-center gap-0.5" title={`${row.confidence.high} high-confidence (user override)`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              <span className="text-[10px] text-brand-medium-gray tabular-nums">{row.confidence.high}</span>
                            </span>
                          )}
                          {row.confidence.medium > 0 && (
                            <span className="flex items-center gap-0.5" title={`${row.confidence.medium} medium-confidence (seeded reach)`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                              <span className="text-[10px] text-brand-medium-gray tabular-nums">{row.confidence.medium}</span>
                            </span>
                          )}
                          {row.confidence.low > 0 && (
                            <span className="flex items-center gap-0.5" title={`${row.confidence.low} low-confidence (no reach data)`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-light-gray inline-block" />
                              <span className="text-[10px] text-brand-medium-gray tabular-nums">{row.confidence.low}</span>
                            </span>
                          )}
                          {totalConf === 0 && <span className="text-brand-medium-gray text-[10px]">—</span>}
                        </div>
                      </td>
                      {/* Forecast MQL */}
                      <td className="px-3 py-2.5 text-right tabular-nums text-brand-black">
                        {row.covered > 0 ? Math.round(row.mqlFcst).toLocaleString() : <span className="text-brand-medium-gray">—</span>}
                      </td>
                      {/* MQL attainment */}
                      <td className="px-3 py-2.5">
                        {mqlPct !== null && ref ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-brand-light-gray rounded-full overflow-hidden max-w-[80px]">
                              <div
                                className={`h-full rounded-full transition-all ${mqlPct >= 80 ? "bg-emerald-500" : mqlPct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${Math.min(mqlPct, 100)}%` }}
                              />
                            </div>
                            <span className={`tabular-nums text-[10px] ${mqlPct >= 80 ? "text-emerald-600" : mqlPct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                              {mqlPct}%
                            </span>
                            <span className="text-brand-medium-gray text-[10px]">of {ref.mql.toLocaleString()}</span>
                          </div>
                        ) : (
                          <span className="text-brand-medium-gray text-[10px]">no data</span>
                        )}
                      </td>
                      {/* Forecast SAO */}
                      <td className="px-3 py-2.5 text-right tabular-nums text-brand-black">
                        {row.covered > 0 && row.saoFcst > 0 ? Math.round(row.saoFcst).toLocaleString() : <span className="text-brand-medium-gray">—</span>}
                      </td>
                      {/* SAO attainment */}
                      <td className="px-3 py-2.5 pr-5">
                        {saoPct !== null && ref ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-brand-light-gray rounded-full overflow-hidden max-w-[80px]">
                              <div
                                className={`h-full rounded-full transition-all ${saoPct >= 80 ? "bg-emerald-500" : saoPct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${Math.min(saoPct, 100)}%` }}
                              />
                            </div>
                            <span className={`tabular-nums text-[10px] ${saoPct >= 80 ? "text-emerald-600" : saoPct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                              {saoPct}%
                            </span>
                            <span className="text-brand-medium-gray text-[10px]">of {ref.sao.toLocaleString()}</span>
                          </div>
                        ) : (
                          <span className="text-brand-medium-gray text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                    {subEntries.map(([sub, sr]) => {
                      const srMqlPct = ref && sr.covered > 0 ? Math.round((sr.mqlFcst / ref.mql) * 100) : null
                      return (
                        <tr key={`${region}-${sub}`} className="border-b border-brand-light-gray bg-[#FAFAFA] hover:bg-[#F3F3F3] transition-colors">
                          <td className="px-5 py-1.5 font-mono text-[11px] text-brand-medium-gray pl-10 col-span-1">
                            ↳ {sub}
                            <span className="ml-1.5 text-[10px]">({sr.count})</span>
                          </td>
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5 text-right tabular-nums text-brand-medium-gray text-[11px]">
                            {sr.covered > 0 ? Math.round(sr.mqlFcst).toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-1.5">
                            {srMqlPct !== null ? (
                              <span className="text-[10px] text-brand-medium-gray tabular-nums">{srMqlPct}%</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-brand-medium-gray text-[11px]">
                            {sr.covered > 0 && sr.saoFcst > 0 ? Math.round(sr.saoFcst).toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-1.5 pr-5" />
                        </tr>
                      )
                    })}
                  </React.Fragment>
                )
              })}
              {/* Totals row */}
              <tr className="border-t-2 border-brand-black bg-[#F7F7F5]">
                <td className="px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">
                  Total · non-cancelled
                  <span className="ml-1.5 normal-case">({filtered.filter(a => (overrides[a.id]?.status) !== "cancelled").length} activities)</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1.5">
                    {(() => {
                      const totHigh = SALES_REGIONS.reduce((s, r) => s + (regionRollup[r]?.confidence.high ?? 0), 0)
                      const totMed = SALES_REGIONS.reduce((s, r) => s + (regionRollup[r]?.confidence.medium ?? 0), 0)
                      const totLow = SALES_REGIONS.reduce((s, r) => s + (regionRollup[r]?.confidence.low ?? 0), 0)
                      return (
                        <>
                          {totHigh > 0 && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /><span className="text-[10px] text-brand-medium-gray tabular-nums">{totHigh}</span></>}
                          {totMed > 0 && <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /><span className="text-[10px] text-brand-medium-gray tabular-nums">{totMed}</span></>}
                          {totLow > 0 && <><span className="w-1.5 h-1.5 rounded-full bg-brand-light-gray inline-block" /><span className="text-[10px] text-brand-medium-gray tabular-nums">{totLow}</span></>}
                        </>
                      )
                    })()}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-brand-black">
                  {forecastRollup.totalMql.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-brand-medium-gray">
                  {forecastRollup.totalMql > 0 && (() => {
                    const totalRef = SALES_REGIONS.reduce((s, r) => s + (FY26_REGION_REF[r]?.mql ?? 0), 0)
                    const pct = totalRef > 0 ? Math.round((forecastRollup.totalMql / totalRef) * 100) : null
                    return pct !== null ? `${pct}% of ${totalRef.toLocaleString()}` : null
                  })()}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-brand-black">
                  {forecastRollup.totalSao.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 pr-5 font-mono text-[10px] text-brand-medium-gray">
                  {forecastRollup.totalSao > 0 && (() => {
                    const totalRef = SALES_REGIONS.reduce((s, r) => s + (FY26_REGION_REF[r]?.sao ?? 0), 0)
                    const pct = totalRef > 0 ? Math.round((forecastRollup.totalSao / totalRef) * 100) : null
                    return pct !== null ? `${pct}% of ${totalRef.toLocaleString()}` : null
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Stats bar */}
      {view === "list" && (
        <div className="bg-white border border-brand-black px-5 py-3 flex items-center gap-6 flex-wrap font-mono text-xs text-brand-medium-gray">
          <span>
            <span className="text-brand-black">{filtered.length}</span> of {ahead.length} upcoming activities shown
          </span>
          <span>
            MQL fcst: <span className="text-brand-black">{mqlFcstFilled}</span> of {filtered.length} with a value
          </span>
          <span>
            MQL actual: <span className="text-brand-black">{mqlActualFilled}</span> of {filtered.length} entered
          </span>
          <span className="ml-auto text-brand-medium-gray">
            Grey = auto-calc · click any ✎ cell to override · saved in browser
          </span>
        </div>
      )}

      {/* List or Calendar */}
      {view === "list" ? (
        <div className="bg-white border border-brand-black">
          <ListView
            activities={filtered}
            quarterFilter={quarterFilter}
            overrides={overrides}
            setField={setField}
            setStringField={setStringField}
            onEdit={a => setEditingActivity(a)}
          />
        </div>
      ) : (
        <div className="mt-6">
          <CalendarView activities={filtered} />
        </div>
      )}

      <EditPanel
        activity={editingActivity}
        overrides={overrides}
        setField={setField}
        setStringField={setStringField}
        quarterFilter={quarterFilter}
        onClose={() => setEditingActivity(null)}
      />
    </div>
  )
}

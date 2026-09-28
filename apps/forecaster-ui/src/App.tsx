import { useEffect, useRef, useState } from "react"
import { PlanProvider, usePlan } from "./store"
import { AdminProvider, useAdmin } from "./admin"
import OverviewView from "./views/OverviewView"
import TargetsView from "./views/TargetsView"
import EngineView from "./views/EngineView"
import BetsView from "./views/BetsView"

import AsanaView from "./views/AsanaView"
import ActivitiesView from "./views/ActivitiesView"
import PacingView from "./views/PacingView"

type View = "overview" | "targets" | "engine" | "bets" | "activities" | "pacing" | "asana"

const NAV: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "targets", label: "Targets" },
  { id: "engine", label: "Engine" },
  { id: "bets", label: "Bets" },

  { id: "activities", label: "Activities" },
  { id: "pacing", label: "Pacing" },
  { id: "asana", label: "Data Sources" },
]

function FigmaLogo() {
  return (
    <svg viewBox="0 0 10 15" fill="none" width="10" height="15" aria-label="Figma">
      <path d="M2.5 15C3.88 15 5 13.88 5 12.5V10H2.5a2.5 2.5 0 0 0 0 5z" fill="#0ACF83"/>
      <path d="M0 7.5C0 6.12 1.12 5 2.5 5H5v5H2.5A2.5 2.5 0 0 1 0 7.5z" fill="#A259FF"/>
      <path d="M0 2.5C0 1.12 1.12 0 2.5 0H5v5H2.5A2.5 2.5 0 0 1 0 2.5z" fill="#F24E1E"/>
      <path d="M5 0h2.5a2.5 2.5 0 0 1 0 5H5V0z" fill="#FF7262"/>
      <path d="M10 7.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" fill="#1ABCFE"/>
    </svg>
  )
}

function SyncDot() {
  const { syncing } = usePlan()
  return (
    <span className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/80 uppercase">
      How we plan · FY26
      <span
        title={syncing ? "Syncing…" : "Live"}
        className={`inline-block w-1.5 h-1.5 rounded-full transition-colors ${syncing ? "bg-brand-hot-red" : "bg-brand-lime"}`}
      />
    </span>
  )
}

function AdminModal({ onClose }: { onClose: () => void }) {
  const { email, role, isAdmin } = useAdmin()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="figma-access-title"
    >
      <div className="bg-white border border-brand-black w-80 shadow-2xl">
        <div className="px-6 py-6">
          <h2 id="figma-access-title" className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider mb-4">
            Figma access
          </h2>
          <p className="text-sm text-brand-black mb-1">{email || "Signed-in Figma user"}</p>
          <p className="text-sm text-brand-medium-gray mb-6">
            Role: {role}. {isAdmin ? "Editing is enabled." : "This workspace is read-only."}
          </p>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="px-4 py-2 bg-brand-black text-white text-sm hover:bg-brand-maroon transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  const [view, setView] = useState<View>("overview")
  const [adminOpen, setAdminOpen] = useState(false)
  const { isAdmin } = useAdmin()

  return (
    <div className="min-h-full bg-[#F7F7F2] text-brand-black">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="sticky top-0 z-10 bg-brand-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 shrink-0">
            <FigmaLogo />
            <SyncDot />
            <span className="font-mono text-[10px] px-2 py-1 border border-brand-lime text-brand-lime tracking-widest uppercase leading-none">
              WIP
            </span>
          </div>
          <nav aria-label="Primary" className="flex items-center gap-0.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
            {NAV.map((item) => (
              <span key={item.id} className="flex items-center">
                {item.id === "targets" && <span className="w-px h-3 bg-white/10 mx-1" />}
                {item.id === "activities" && <span className="w-px h-3 bg-white/10 mx-1" />}
                {item.id === "pacing" && <span className="w-px h-3 bg-white/10 mx-1" />}
                {item.id === "asana" && <span className="w-px h-3 bg-white/10 mx-1" />}
                <button
                  onClick={() => setView(item.id)}
                  aria-current={view === item.id ? "page" : undefined}
                  className={`px-3 py-2 font-mono text-xs tracking-wide transition-colors whitespace-nowrap ${
                    view === item.id
                      ? "bg-brand-lime text-brand-black"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              </span>
            ))}

            <span className="w-px h-3 bg-white/10 mx-1" />
            <button
              onClick={() => setAdminOpen(true)}
              title={isAdmin ? "Admin mode active" : "Admin access"}
              aria-label={isAdmin ? "Open admin access details; admin mode active" : "Open admin access details"}
              className={`w-7 h-7 flex items-center justify-center transition-colors hover:bg-white/8 ${
                isAdmin ? "text-brand-lime" : "text-white/75 hover:text-white"
              }`}
            >
              {isAdmin ? (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="1" y="5.5" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4 5.5V3.5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="6.5" cy="9" r="1" fill="currentColor" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="1" y="5.5" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4 5.5V3.5a2.5 2.5 0 0 1 5 0" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
                  <circle cx="6.5" cy="9" r="1" fill="currentColor" />
                </svg>
              )}
            </button>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {view === "overview" && <OverviewView />}
        {view === "targets" && <TargetsView />}
        {view === "engine" && <EngineView />}
        {view === "bets" && <BetsView />}

        {view === "activities" && <ActivitiesView />}
        {view === "pacing" && <PacingView />}
        {view === "asana" && <AsanaView />}
      </main>

      {adminOpen && <AdminModal onClose={() => setAdminOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <PlanProvider>
      <AdminProvider>
        <AppShell />
      </AdminProvider>
    </PlanProvider>
  )
}

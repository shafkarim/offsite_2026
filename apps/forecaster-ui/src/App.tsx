import { lazy, Suspense, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { PlanProvider, usePlan } from "./store"
import { AdminProvider, useAdmin } from "./admin"
import {
  CollaborationProvider,
  roleLabel,
  useCollaboration,
  WorkspaceRole,
} from "./collaboration"
import { FORECAST_CONTRACT, FORECAST_WORKFLOW } from "./data/forecast-contract"
import { PacingProvider, usePacing } from "./pacing"
import { AsanaProvider, useAsanaActivities } from "./activities"

const OverviewView = lazy(() => import("./views/OverviewView"))
const WorkQueueView = lazy(() => import("./views/WorkQueueView"))
const DecisionsView = lazy(() => import("./views/DecisionsView"))
const TargetsView = lazy(() => import("./views/TargetsView"))
const EngineView = lazy(() => import("./views/EngineView"))
const BetsView = lazy(() => import("./views/BetsView"))
const ActivitiesView = lazy(() => import("./views/ActivitiesView"))
const PacingView = lazy(() => import("./views/PacingView"))
const MethodologyView = lazy(() => import("./views/MethodologyView"))
const DataHealthView = lazy(() => import("./views/DataHealthView"))
const AsanaView = lazy(() => import("./views/AsanaView"))

type View = "overview" | "work" | "decisions" | "targets" | "engine" | "bets" | "activities" | "pacing" | "methodology" | "data-health" | "asana"
type NavItem = {
  id: View
  label: string
  description: string
  icon: "pulse" | "target" | "engine" | "spark" | "calendar" | "pace" | "database"
}

const NAV_GROUPS: { label: string, items: NavItem[] }[] = [
  {
    label: "Plan flow",
    items: [
      {
        id: "overview",
        label: "Forecast",
        description: "Outlook, gap, and next moves",
        icon: "pulse",
      },
      {
        id: "engine",
        label: "Drivers",
        description: "Sources, assumptions, and scenarios",
        icon: "engine",
      },
      {
        id: "activities",
        label: "Plan",
        description: "Activities, commitments, and owners",
        icon: "calendar",
      },
      {
        id: "pacing",
        label: "Performance",
        description: "Actuals, pace, and interventions",
        icon: "pace",
      },
    ],
  },
  {
    label: "Workspace controls",
    items: [
      {
        id: "work",
        label: "Work queue",
        description: "Exceptions that need an owner",
        icon: "calendar",
      },
      {
        id: "decisions",
        label: "Decisions",
        description: "Approvals and trade-offs",
        icon: "spark",
      },
      {
        id: "targets",
        label: "Target contract",
        description: "The shared FY26 outcome",
        icon: "target",
      },
      {
        id: "bets",
        label: "Bets",
        description: "Incremental Q4 upside",
        icon: "spark",
      },
      {
        id: "methodology",
        label: "Methodology",
        description: "Rules, assumptions, and guardrails",
        icon: "engine",
      },
      {
        id: "data-health",
        label: "Data health",
        description: "Quality checks and ownership",
        icon: "database",
      },
      {
        id: "asana",
        label: "Data sources",
        description: "Connections and freshness",
        icon: "database",
      },
    ],
  },
]
const NAV = NAV_GROUPS.flatMap((group) => group.items)

function Icon({
  name,
  size = 17,
}: {
  name: NavItem["icon"] | "lock" | "menu" | "search" | "close"
  size?: number
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 20 20",
    fill: "none",
    "aria-hidden": true,
  }
  if (name === "pulse")
    return (
      <svg {...common}>
        <path
          d="M2 10h3l2-5 3 10 2.5-7 1.5 2h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  if (name === "target")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 1.5V5M18.5 10H15"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    )
  if (name === "engine")
    return (
      <svg {...common}>
        <path
          d="M3 5h14M3 10h14M3 15h14"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle
          cx="7"
          cy="5"
          r="1.7"
          fill="var(--color-brand-lime)"
          stroke="currentColor"
        />
        <circle cx="13" cy="10" r="1.7" fill="white" stroke="currentColor" />
        <circle cx="9" cy="15" r="1.7" fill="white" stroke="currentColor" />
      </svg>
    )
  if (name === "spark")
    return (
      <svg {...common}>
        <path
          d="m10 2 1.6 5.1L17 9l-5.4 1.9L10 16l-1.6-5.1L3 9l5.4-1.9L10 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  if (name === "calendar")
    return (
      <svg {...common}>
        <rect
          x="3"
          y="4"
          width="14"
          height="13"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M3 8h14M7 2.5V5.5M13 2.5V5.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    )
  if (name === "pace")
    return (
      <svg {...common}>
        <path
          d="M3 15.5V11l3-3 3 2 4-5 4 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M3 17h14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  if (name === "database")
    return (
      <svg {...common}>
        <ellipse
          cx="10"
          cy="5"
          rx="6.5"
          ry="2.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M3.5 5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V5M3.5 10v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    )
  if (name === "lock")
    return (
      <svg {...common}>
        <rect
          x="4"
          y="8"
          width="12"
          height="9"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M7 8V6a3 3 0 0 1 6 0v2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    )
  if (name === "menu")
    return (
      <svg {...common}>
        <path
          d="M3 5h14M3 10h14M3 15h14"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    )
  if (name === "search")
    return (
      <svg {...common}>
        <circle
          cx="8.5"
          cy="8.5"
          r="5.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m13 13 4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="m4 4 12 12M16 4 4 16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function Mark() {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-brand-light-gray bg-white text-brand-black" aria-hidden="true">
      <img
        src={`${import.meta.env.BASE_URL}brand/figma-mark.png`}
        alt=""
        className="h-[30px] w-5 object-contain"
      />
    </span>
  )
}

function SyncStatus() {
  const { syncing, storageMode, syncError } = usePlan()
  const label = syncError
    ? "Sync issue"
    : syncing
      ? "Saving"
      : storageMode === "shared"
        ? "Shared"
        : "Local preview"
  return (
    <div
      className="flex items-center gap-2"
      title={syncError || (storageMode === "shared" ? "Changes are shared with this workspace" : "Using the legacy prototype record")}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          syncError
            ? "border-2 border-brand-hot-red bg-transparent"
            : syncing
              ? "animate-pulse bg-brand-dusty-violet"
              : "bg-brand-lime"
        }`}
      />
      <span className="text-xs text-white/55">{label}</span>
    </div>
  )
}

function AdminModal({ onClose }: { onClose: () => void }) {
  const { unlock, pinConfigured, lock, isAdmin, accessMode, role } = useAdmin()
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [onClose])

  async function handleSubmit() {
    if (pin.length < 4) return
    setSubmitting(true)
    setError(null)
    const result = await unlock(pin)
    setSubmitting(false)
    if (result === "wrong") {
      setError("That PIN isn't right. Try again.")
      setPin("")
      inputRef.current?.focus()
    } else onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-black/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-white shadow-2xl ring-1 ring-brand-black/10">
        <div className="flex items-center justify-between border-b border-brand-light-gray px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center bg-brand-black text-white">
              <Icon name="lock" size={15} />
            </span>
            <div>
              <h2 id="admin-title" className="text-base">
                Admin access
              </h2>
              <p className="text-xs text-brand-medium-gray">
                Planning controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center text-brand-medium-gray hover:bg-brand-light-gray/50 hover:text-brand-black"
            aria-label="Close"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        {accessMode === "shared-role" ? (
          <div className="p-6">
            <span className={`mb-4 inline-flex items-center gap-2 px-2.5 py-1 text-xs ${isAdmin ? "bg-brand-lime" : "bg-brand-light-gray"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isAdmin ? "bg-brand-dark-green" : "bg-brand-medium-gray"}`} />
              {roleLabel(role)} role
            </span>
            <p className="mb-6 text-sm leading-relaxed text-brand-medium-gray">
              {isAdmin
                ? "Your workspace role allows planning changes. Every shared save is attributed to your account."
                : "Your viewer role keeps the plan read-only. Ask a workspace admin for contributor access to make changes."}
            </p>
            <button onClick={onClose} className="border border-brand-black px-4 py-2.5 text-sm hover:bg-brand-black hover:text-white">
              Done
            </button>
          </div>
        ) : isAdmin ? (
          <div className="p-6">
            <span className="mb-4 inline-flex items-center gap-2 bg-brand-lime px-2.5 py-1 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-dark-green" />
              Admin mode is active
            </span>
            <p className="mb-6 text-sm leading-relaxed text-brand-medium-gray">
              You can edit targets, programs, and bets. Lock the workspace to
              return to read-only mode.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  lock()
                  onClose()
                }}
                className="bg-brand-black px-4 py-2.5 text-sm text-white hover:bg-brand-maroon"
              >
                Lock workspace
              </button>
              <button
                onClick={onClose}
                className="border border-brand-light-gray px-4 py-2.5 text-sm hover:border-brand-black"
              >
                Keep unlocked
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <p className="mb-5 text-sm leading-relaxed text-brand-medium-gray">
              {pinConfigured
                ? "Enter the admin PIN to edit the plan."
                : "Create an admin PIN for this workspace."}
            </p>
            <label
              className="mb-2 block text-xs text-brand-medium-gray"
              htmlFor="admin-pin"
            >
              {pinConfigured ? "Admin PIN" : "New admin PIN"}
            </label>
            <input
              id="admin-pin"
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, ""))
                setError(null)
              }}
              onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
              placeholder="4–8 digits"
              className="mb-2 w-full border border-brand-light-gray px-3.5 py-2.5 font-mono text-sm tracking-[0.18em] outline-none focus:border-brand-black"
            />
            <div className="min-h-5">
              {error && (
                <p className="border-l-2 border-brand-hot-red pl-2 text-xs text-brand-black">
                  {error}
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={pin.length < 4 || submitting}
                className="bg-brand-black px-4 py-2.5 text-sm text-white hover:bg-brand-maroon disabled:cursor-not-allowed disabled:opacity-30"
              >
                {submitting
                  ? "Checking…"
                  : pinConfigured
                    ? "Unlock"
                    : "Create PIN"}
              </button>
              <button
                onClick={onClose}
                className="border border-brand-light-gray px-4 py-2.5 text-sm hover:border-brand-black"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CollaborationModal({ onClose }: { onClose: () => void }) {
  const {
    user,
    profileName,
    workspace,
    role,
    members,
    onlineCount,
    loading,
    schemaReady,
    canManage,
    notice,
    signIn,
    signOut,
    createWorkspace,
    inviteMember,
    updateProfileName,
  } = useCollaboration()
  const [email, setEmail] = useState("")
  const [workspaceName, setWorkspaceName] = useState("Figma FY26 forecast")
  const [name, setName] = useState(profileName)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("contributor")
  const [message, setMessage] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const isFigmaEmail = /^[^@\s]+@figma\.com$/i.test(email.trim())
  const isFigmaInvite = /^[^@\s]+@figma\.com$/i.test(inviteEmail.trim())

  useEffect(() => setName(profileName), [profileName])
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [onClose])

  async function run(task: () => Promise<string | null>, success: string) {
    setWorking(true)
    setMessage(null)
    const taskError = await task()
    setWorking(false)
    setMessage(taskError || success)
    return !taskError
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-black/65 p-4 backdrop-blur-[4px]" role="dialog" aria-modal="true" aria-labelledby="collaboration-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-white/20">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-5 border-b border-brand-black/10 bg-brand-periwinkle px-6 py-5">
          <div className="flex items-center gap-3">
            <Mark />
            <div>
              <h2 id="collaboration-title" className="text-lg">Figma forecast workspace</h2>
              <p className="text-xs text-brand-black/65">FY26 marketing planning · one shared source of truth</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/70 text-brand-black hover:bg-white" aria-label="Close"><Icon name="close" size={16} /></button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-brand-medium-gray">Checking Figma workspace access…</div>
        ) : !user ? (
          <div className="p-6 sm:p-7">
            <p className="font-mono text-[10px] uppercase tracking-widest text-brand-blue">Figma identity</p>
            <h3 className="mt-2 text-2xl">Join the shared FY26 forecast</h3>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-brand-medium-gray">Use your Figma email to work from the same targets, forecast, activity plan, and decision history as the rest of the marketing team.</p>
            <label htmlFor="collaboration-email" className="mt-6 mb-2 block text-xs font-medium">Figma email</label>
            <input id="collaboration-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@figma.com" autoComplete="email" className="w-full rounded-xl border border-brand-light-gray px-4 py-3 text-base outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-periwinkle" />
            {email.trim() && !isFigmaEmail && <p className="mt-2 text-xs text-brand-hot-red">Use your @figma.com email address.</p>}
            <button disabled={working || !isFigmaEmail} onClick={() => void run(() => signIn(email), "Check your Figma inbox for a secure sign-in link.")} className="mt-3 rounded-xl bg-brand-blue px-5 py-3 text-sm text-white transition hover:bg-brand-black disabled:cursor-not-allowed disabled:bg-brand-light-gray disabled:text-brand-medium-gray">{working ? "Sending…" : "Continue with Figma email"}</button>
            <p className="mt-2 text-xs text-brand-medium-gray">We’ll send a secure, passwordless link to your Figma inbox.</p>
            <div className="mt-7 rounded-2xl bg-brand-mint p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-brand-dark-green">Preview access</p>
              <p className="mt-1 text-sm">Local planning mode</p>
              <p className="mt-1 text-xs leading-relaxed text-brand-medium-gray">You can explore the forecast without signing in. A Figma workspace is required to share changes, assign roles, and show who changed what.</p>
            </div>
            {message && <p className="mt-4 rounded-xl bg-brand-mint px-4 py-3 text-xs">{message}</p>}
          </div>
        ) : !schemaReady ? (
          <div className="p-6 sm:p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-brand-blue">Figma account connected</p><p className="mt-2 text-sm">Signed in as {user.email}</p><p className="mt-5 rounded-2xl bg-brand-mint p-4 text-sm leading-relaxed text-brand-medium-gray">Shared Figma workspaces are not enabled in this preview yet. Your local planning copy remains available, and no work is lost.</p><button onClick={() => void signOut()} className="mt-5 rounded-xl border border-brand-black px-4 py-2.5 text-sm hover:bg-brand-black hover:text-white">Sign out</button></div>
        ) : !workspace ? (
          <div className="p-6 sm:p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-brand-blue">Create the Figma workspace</p><h3 className="mt-2 text-2xl">Bring the marketing plan together</h3><p className="mt-2 mb-6 text-sm leading-relaxed text-brand-medium-gray">Your Figma account is connected, but it is not part of a forecast workspace yet. Create the FY26 workspace and you’ll become its first admin.</p><label htmlFor="workspace-name" className="mb-2 block text-xs font-medium">Workspace name</label><input id="workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} className="w-full rounded-xl border border-brand-light-gray px-4 py-3 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-periwinkle" /><button disabled={working || !workspaceName.trim()} onClick={() => void run(() => createWorkspace(workspaceName), "Figma forecast workspace created.")} className="mt-3 rounded-xl bg-brand-blue px-5 py-3 text-sm text-white hover:bg-brand-black disabled:opacity-35">{working ? "Creating…" : "Create Figma workspace"}</button>{notice && <p className="mt-4 text-xs text-brand-medium-gray">{notice}</p>}{message && <p className="mt-4 rounded-xl bg-brand-mint px-4 py-3 text-xs">{message}</p>}</div>
        ) : (
          <div>
            <div className="border-b border-brand-light-gray p-6"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-brand-blue">Figma forecast workspace</p><h3 className="mt-1 text-xl">{workspace.name}</h3><p className="mt-1 text-xs text-brand-medium-gray">{onlineCount} online · {members.length} Figma teammates</p></div><span className="rounded-full bg-brand-lime px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest">{roleLabel(role)}</span></div></div>

            <div className="border-b border-brand-light-gray p-6"><p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Your identity</p><div className="flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 border border-brand-light-gray px-3 py-2 text-sm outline-none focus:border-brand-black" /><button disabled={working || name.trim() === profileName} onClick={() => void run(() => updateProfileName(name), "Profile updated.")} className="border border-brand-black px-3 py-2 text-xs hover:bg-brand-black hover:text-white disabled:opacity-30">Save</button></div><p className="mt-2 text-xs text-brand-medium-gray">{user.email}</p></div>

            <div className="border-b border-brand-light-gray p-6"><p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Figma teammates</p><div className="space-y-2">{members.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-xl border border-brand-light-gray px-3 py-2.5"><span className={`h-2 w-2 rounded-full ${member.online ? "bg-brand-kelly-green" : "bg-brand-light-gray"}`} /><span className="min-w-0 flex-1 truncate text-sm">{member.name}</span><span className="font-mono text-[10px] uppercase text-brand-medium-gray">{member.role}</span></div>)}</div></div>

            {canManage && <div className="border-b border-brand-light-gray p-6"><p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-brand-medium-gray">Invite a Figma teammate</p><p className="mb-3 text-xs leading-relaxed text-brand-medium-gray">Invite their @figma.com address, choose what they can do, then send them this app link.</p><div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]"><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@figma.com" className="min-w-0 rounded-xl border border-brand-light-gray px-3 py-2 text-sm outline-none focus:border-brand-blue" /><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)} className="rounded-xl border border-brand-light-gray bg-white px-2 py-2 text-xs"><option value="viewer">Viewer</option><option value="contributor">Contributor</option><option value="approver">Approver</option><option value="admin">Admin</option></select><button disabled={working || !isFigmaInvite} onClick={() => void run(() => inviteMember(inviteEmail, inviteRole), "Figma teammate invited.").then((ok) => ok && setInviteEmail(""))} className="rounded-xl bg-brand-blue px-3 py-2 text-xs text-white hover:bg-brand-black disabled:opacity-35">Invite</button></div>{inviteEmail.trim() && !isFigmaInvite && <p className="mt-2 text-xs text-brand-hot-red">Invite a teammate using their @figma.com email.</p>}</div>}

            <div className="p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm">The shared Figma plan is live</p><p className="mt-0.5 text-xs text-brand-medium-gray">Forecast, activity, and decision updates are attributed to each Figma teammate.</p></div><button onClick={() => void signOut()} className="rounded-xl border border-brand-light-gray px-3 py-2 text-xs hover:border-brand-black">Sign out</button></div>{message && <p className="mt-4 rounded-xl bg-brand-mint px-4 py-3 text-xs">{message}</p>}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickJump({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (view: View) => void
}) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    const value = query.trim().toLowerCase()
    return value
      ? NAV.filter((item) =>
          `${item.label} ${item.description}`.toLowerCase().includes(value),
        )
      : NAV
  }, [query])
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  return (
    <div
      className="fixed inset-0 z-[65] flex items-start justify-center bg-brand-black/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Quick jump"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg overflow-hidden bg-white shadow-2xl ring-1 ring-brand-black/10">
        <div className="flex items-center gap-3 border-b border-brand-light-gray px-4">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose()
              if (event.key === "Enter" && results[0]) onSelect(results[0].id)
            }}
            placeholder="Search Figma Forecast…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-brand-medium-gray/60"
          />
          <kbd className="border border-brand-light-gray px-1.5 py-0.5 font-mono text-[10px] text-brand-medium-gray">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="group flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-brand-lime"
            >
              <span className="grid h-9 w-9 place-items-center border border-brand-light-gray group-hover:border-brand-black">
                <Icon name={item.icon} />
              </span>
              <span>
                <span className="block text-sm">{item.label}</span>
                <span className="block text-xs text-brand-medium-gray">
                  {item.description}
                </span>
              </span>
              <span className="ml-auto text-brand-medium-gray">→</span>
            </button>
          ))}
          {results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-brand-medium-gray">
              No workspace matches “{query}”.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const VIEW_STAGE: Record<View, "overview" | "engine" | "activities" | "pacing"> = {
  overview: "overview",
  targets: "overview",
  decisions: "overview",
  engine: "engine",
  methodology: "engine",
  "data-health": "engine",
  asana: "engine",
  activities: "activities",
  bets: "activities",
  work: "activities",
  pacing: "pacing",
}

function WorkflowBar({
  view,
  onSelect,
}: {
  view: View
  onSelect: (view: View) => void
}) {
  const activeStage = VIEW_STAGE[view]
  return (
    <div className="border-b border-brand-light-gray bg-white px-4 py-3 md:px-7 lg:px-10">
      <div className="mx-auto flex max-w-[1440px] items-stretch gap-2 overflow-x-auto">
        <div className="hidden min-w-[210px] shrink-0 border-r border-brand-light-gray py-2 pr-5 xl:block">
          <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Forecast contract</p>
          <p className="mt-1 text-sm">{FORECAST_CONTRACT.period} · {FORECAST_CONTRACT.scope}</p>
          <p className="mt-0.5 font-mono text-xs text-brand-medium-gray">As of {FORECAST_CONTRACT.asOf} · {FORECAST_CONTRACT.status}</p>
        </div>
        <div className="flex min-w-0 flex-1 gap-2">
          {FORECAST_WORKFLOW.map((step) => {
            const active = activeStage === step.id
            return (
              <button
                key={step.id}
                onClick={() => onSelect(step.id as View)}
                aria-current={active ? "step" : undefined}
                className={`min-w-[112px] flex-1 rounded-lg px-3 py-2.5 text-left transition-colors sm:min-w-[180px] sm:px-4 ${active ? "bg-brand-periwinkle" : "hover:bg-brand-light-gray"}`}
              >
                <span className={`block font-mono text-xs uppercase tracking-widest sm:inline ${active ? "text-brand-black" : "text-brand-medium-gray"}`}>{step.step}</span>
                <span className="text-sm sm:ml-2">{step.label}</span>
                <span className={`mt-0.5 hidden text-xs sm:block ${active ? "text-brand-black/70" : "text-brand-medium-gray"}`}>{step.description}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function LiveSourceBoundary({
  source,
  children,
}: {
  source: "asana" | "hex"
  children: ReactNode
}) {
  const asana = useAsanaActivities()
  const pacing = usePacing()
  const live = source === "asana" ? asana.mode === "live" : pacing.mode === "live"
  const loading = source === "asana" ? asana.mode === "loading" : pacing.mode === "loading"
  const message = source === "asana" ? asana.message : pacing.message

  if (live) return <>{children}</>

  return (
    <div role={loading ? "status" : "alert"} className="max-w-3xl rounded-xl border border-brand-hot-red/50 bg-white p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">
        {loading ? "Connecting live source" : "Live source required"}
      </p>
      <h1 className="mt-2 text-3xl">
        {source === "asana" ? "Asana activities are unavailable" : "Governed Hex outputs are unavailable"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brand-medium-gray">
        {message} This workspace will not replace missing live data with bundled snapshots.
      </p>
    </div>
  )
}

function AppShell() {
  const initialHash = window.location.hash.replace("#", "") as View
  const [view, setView] = useState<View>(
    NAV.some((item) => item.id === initialHash) ? initialHash : "overview",
  )
  const [adminOpen, setAdminOpen] = useState(false)
  const [collaborationOpen, setCollaborationOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [quickJumpOpen, setQuickJumpOpen] = useState(false)
  const { isAdmin } = useAdmin()
  const { isShared, workspace, role, profileName, onlineCount } = useCollaboration()
  const current = NAV.find((item) => item.id === view) ?? NAV[0]

  function selectView(next: View) {
    setView(next)
    setMobileOpen(false)
    setQuickJumpOpen(false)
    window.history.replaceState(null, "", `#${next}`)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  useEffect(() => {
    document.title = `${current.label} · Figma Forecast`
  }, [current.label])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setQuickJumpOpen(true)
      }
      if (event.key === "Escape") {
        setMobileOpen(false)
        setQuickJumpOpen(false)
        setCollaborationOpen(false)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  const renderNavItems = (items: NavItem[]) => (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => selectView(item.id)}
          aria-current={view === item.id ? "page" : undefined}
          className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
            view === item.id
              ? "bg-brand-blue text-white"
              : "text-brand-light-gray hover:bg-white/[0.09] hover:text-white"
          }`}
        >
          <span
            className={
              view === item.id
                ? "text-white"
                : "text-white/45 group-hover:text-white"
            }
          >
            <Icon name={item.icon} />
          </span>
          <span className="text-sm">{item.label}</span>
          {view === item.id && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
          )}
        </button>
      ))}
    </div>
  )

  const nav = (
    <>
      <div className="flex h-[84px] items-center border-b border-white/15 px-5">
        <Mark />
        <div className="ml-3 min-w-0">
          <p className="truncate text-lg text-white">Figma Forecast</p>
          <p className="font-mono text-xs text-white/60">Marketing workspace</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-6">
          <p className="mb-2 px-3 font-mono text-xs uppercase tracking-widest text-white/55">
            {NAV_GROUPS[0].label}
          </p>
          {renderNavItems(NAV_GROUPS[0].items)}
        </div>
        <details
          className="group/controls border-t border-white/10 pt-4"
          open={NAV_GROUPS[1].items.some((item) => item.id === view)}
        >
          <summary className="mb-2 flex cursor-pointer list-none items-center justify-between px-3 py-2 font-mono text-xs uppercase tracking-widest text-white/60 hover:text-white">
            <span>{NAV_GROUPS[1].label}</span>
            <span className="transition-transform group-open/controls:rotate-45">+</span>
          </summary>
          {renderNavItems(NAV_GROUPS[1].items)}
        </details>
      </div>
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => setCollaborationOpen(true)}
          className="mb-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-brand-light-gray hover:bg-white/[0.09] hover:text-white"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px] uppercase text-white">
            {profileName.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">
            {workspace?.name ?? "Figma team"}
          </span>
          {isShared && (
            <span className="flex items-center gap-1 font-mono text-xs text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-lime" />
              {onlineCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setAdminOpen(true)}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-brand-light-gray hover:bg-white/[0.09] hover:text-white"
        >
          <Icon name="lock" />
          <span className="text-sm">
            {isShared
              ? `${roleLabel(role)} access`
              : isAdmin
                ? "Admin mode"
                : "Read-only mode"}
          </span>
          {isAdmin && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-lime" />
          )}
        </button>
        <div className="mt-1 flex items-center justify-between px-3 py-2">
          <SyncStatus />
          <button
            onClick={() => setQuickJumpOpen(true)}
            className="flex items-center gap-1 border border-white/10 px-1.5 py-1 text-[10px] text-white/35 hover:border-white/25 hover:text-white/60"
          >
            <span>⌘</span>
            <span>K</span>
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-dvh bg-white text-brand-black">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-black lg:flex">
        {nav}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-brand-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative flex h-full w-[min(82vw,280px)] flex-col bg-brand-black shadow-2xl">
            {nav}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[60px] items-center border-b border-brand-light-gray bg-white/95 px-4 backdrop-blur md:px-7 lg:h-[76px] lg:px-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="mr-3 grid h-11 w-11 place-items-center rounded-lg border border-brand-light-gray lg:hidden"
            aria-label="Open navigation"
            title="Open Figma Forecast navigation"
          >
            <Icon name="menu" size={18} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-base lg:text-lg">{current.label}</p>
            <p className="hidden text-xs text-brand-medium-gray sm:block">
              {current.description}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setCollaborationOpen(true)}
              className={`flex h-11 items-center gap-2 rounded-lg border px-3 text-xs transition-colors ${
                isShared
                  ? "border-brand-black bg-brand-black text-white hover:bg-brand-maroon"
                  : "border-brand-light-gray text-brand-medium-gray hover:border-brand-black hover:text-brand-black"
              }`}
              aria-label="Open team workspace"
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[9px] uppercase ${
                  isShared
                    ? "bg-brand-lime text-brand-black"
                    : "bg-brand-light-gray text-brand-black"
                }`}
              >
                {profileName.slice(0, 1)}
              </span>
              <span className="hidden max-w-32 truncate md:inline">
                {workspace?.name ?? "Figma workspace"}
              </span>
              {isShared && (
                <span className="h-1.5 w-1.5 rounded-full bg-brand-lime" />
              )}
            </button>
            <button
              onClick={() => setQuickJumpOpen(true)}
              className="hidden h-11 items-center gap-2 rounded-lg border border-brand-light-gray px-3 text-xs text-brand-medium-gray hover:border-brand-black hover:text-brand-black sm:flex"
            >
              <Icon name="search" size={14} />
              <span>Quick jump</span>
              <kbd className="ml-2 font-mono text-[10px]">⌘K</kbd>
            </button>
            <button
              onClick={() => setAdminOpen(true)}
              className={`grid h-11 w-11 place-items-center rounded-lg border ${
                isAdmin
                  ? "border-brand-black bg-brand-lime text-brand-black"
                  : "border-brand-light-gray text-brand-medium-gray hover:border-brand-black hover:text-brand-black"
              }`}
              aria-label={isAdmin ? "Admin mode active" : "Open admin access"}
            >
              <Icon name="lock" size={15} />
            </button>
          </div>
        </header>
        <WorkflowBar view={view} onSelect={selectView} />
        <main id="main-content" tabIndex={-1} className="min-w-0 overflow-x-auto bg-white px-4 py-8 md:px-7 lg:px-10 lg:py-10">
          <div className="mx-auto min-w-0 max-w-[1440px]">
            <Suspense
              fallback={
                <div className="grid min-h-[40vh] place-items-center border border-brand-light-gray bg-white">
                  <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">
                    Loading workspace…
                  </p>
                </div>
              }
            >
              {view === "overview" && <OverviewView />}
              {view === "work" && (
                <LiveSourceBoundary source="asana">
                  <WorkQueueView onNavigate={selectView} />
                </LiveSourceBoundary>
              )}
              {view === "decisions" && (
                <LiveSourceBoundary source="hex">
                  <DecisionsView onNavigate={selectView} />
                </LiveSourceBoundary>
              )}
              {view === "targets" && <TargetsView />}
              {view === "engine" && <EngineView />}
              {view === "bets" && <BetsView />}
              {view === "activities" && <ActivitiesView />}
              {view === "pacing" && <PacingView />}
              {view === "methodology" && <MethodologyView />}
              {view === "data-health" && <DataHealthView />}
              {view === "asana" && <AsanaView />}
            </Suspense>
          </div>
        </main>
      </div>
      {adminOpen && <AdminModal onClose={() => setAdminOpen(false)} />}
      {collaborationOpen && (
        <CollaborationModal onClose={() => setCollaborationOpen(false)} />
      )}
      {quickJumpOpen && (
        <QuickJump
          onClose={() => setQuickJumpOpen(false)}
          onSelect={selectView}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <CollaborationProvider>
      <PacingProvider>
        <AsanaProvider>
          <PlanProvider>
            <AdminProvider>
              <AppShell />
            </AdminProvider>
          </PlanProvider>
        </AsanaProvider>
      </PacingProvider>
    </CollaborationProvider>
  )
}

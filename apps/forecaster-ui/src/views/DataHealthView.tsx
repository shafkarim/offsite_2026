import { useCollaboration } from "../collaboration"
import { useLiveAsana, useLiveHex } from "../live-sources"

type Health = "pass" | "warning" | "blocked" | "loading"

function statusClasses(status: Health): string {
  if (status === "pass") return "border-brand-dark-green bg-brand-mint"
  if (status === "warning") return "border-brand-gold bg-[#FFF8DD]"
  if (status === "loading") return "border-brand-dusty-violet bg-[#FAF5FB]"
  return "border-brand-hot-red bg-[#FFF1F1]"
}

function StatusPill({ status, children }: { status: Health; children: string }) {
  return (
    <span className={`inline-flex min-h-8 items-center rounded-full border px-3 font-mono text-xs ${statusClasses(status)}`}>
      {children}
    </span>
  )
}

function formatDate(value?: string | null): string {
  if (!value) return "Not available"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
}

export default function DataHealthView() {
  const asana = useLiveAsana()
  const hex = useLiveHex()
  const collaboration = useCollaboration()

  const asanaHealth: Health = asana.status === "loading"
    ? "loading"
    : asana.status === "live"
      ? "pass"
      : "blocked"
  const hexHealth: Health = hex.status === "loading"
    ? "loading"
    : hex.status === "live"
      ? "pass"
      : "blocked"
  const releaseHealth: Health = !hex.data
    ? hexHealth
    : hex.data.forecastUsable
      ? "pass"
      : "warning"

  return (
    <div>
      <div className="mb-10 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Workspace controls · live assurance</p>
        <h1 className="mt-2 text-4xl">Data health</h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-medium-gray">
          This page verifies the live, governed inputs used by the workspace. Missing sources remain visibly blocked; bundled snapshots and seeded reach values are never substituted.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-xl border border-brand-light-gray bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Activities</p>
              <h2 className="mt-2 text-xl">Asana Marketing Calendar</h2>
            </div>
            <StatusPill status={asanaHealth}>{asana.status}</StatusPill>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Rows available</dt><dd>{asana.data?.activities.length ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Last fetched</dt><dd className="text-right">{formatDate(asana.data?.fetchedAt)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Transport</dt><dd>Server-side API</dd></div>
          </dl>
          <p className="mt-5 text-sm leading-relaxed text-brand-medium-gray">{asana.detail ?? "Owner notes and other unnecessary sensitive fields are stripped before activities reach the browser."}</p>
          <button onClick={() => void asana.refresh()} className="mt-5 rounded-lg border border-brand-black px-4 py-2 text-sm hover:bg-brand-black hover:text-white">Refresh Asana</button>
        </section>

        <section className="rounded-xl border border-brand-light-gray bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Actuals and model output</p>
              <h2 className="mt-2 text-xl">Governed Hex feed</h2>
            </div>
            <StatusPill status={hexHealth}>{hex.status}</StatusPill>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Semantic gate</dt><dd>{hex.data?.feed.semanticSourceGate ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Source governance</dt><dd>{hex.data?.feed.sourceGovernanceStatus ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Source as of</dt><dd>{formatDate(hex.data?.feed.sourceAsOf)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Received</dt><dd>{formatDate(hex.data?.receivedAt)}</dd></div>
          </dl>
          <p className="mt-5 text-sm leading-relaxed text-brand-medium-gray">{hex.detail ?? "Only aggregate, semantic-approved outputs are accepted by the Payload ingestion endpoint."}</p>
          <button onClick={() => void hex.refresh()} className="mt-5 rounded-lg border border-brand-black px-4 py-2 text-sm hover:bg-brand-black hover:text-white">Refresh Hex</button>
        </section>

        <section className="rounded-xl border border-brand-light-gray bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-brand-medium-gray">Release controls</p>
              <h2 className="mt-2 text-xl">Forecast quarantine</h2>
            </div>
            <StatusPill status={releaseHealth}>{hex.data?.forecastUsable ? "usable" : "quarantined"}</StatusPill>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">DS validation</dt><dd>{hex.data?.feed.dsValidationStatus ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Release status</dt><dd className="text-right">{hex.data?.feed.releaseStatus ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Workspace role</dt><dd>{collaboration.role ?? "unavailable"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-medium-gray">Shared storage</dt><dd>{collaboration.isShared ? "Payload" : "blocked"}</dd></div>
          </dl>
          <p className="mt-5 text-sm leading-relaxed text-brand-medium-gray">
            Orgs Web Form forecast output remains quarantined until Data Science approval and all release gates pass. Governed pacing and activity inputs may still be used where their own gates pass.
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-xl bg-brand-black p-6 text-white">
        <p className="font-mono text-xs uppercase tracking-widest text-white/60">Hard safeguards</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            "No Supabase client or browser credential",
            "No raw lead, contact, session or opportunity rows",
            "No silent snapshot fallback",
            "No forecast release while governance gates are blocked",
          ].map((rule) => (
            <div key={rule} className="rounded-lg border border-white/20 p-4 text-sm leading-relaxed">{rule}</div>
          ))}
        </div>
      </section>
    </div>
  )
}

import { useLiveAsana, useLiveHex } from "../live-sources"

function fmtSynced(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function AsanaView() {
  const asana = useLiveAsana()
  const hex = useLiveHex()

  return (
    <div>
      <div className="mb-10">
        <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase mb-3">Data · Asana</p>
        <h1 className="text-5xl tracking-tight mb-3">Asana connection</h1>
        <p className="text-brand-medium-gray max-w-xl leading-relaxed text-[15px]">
          Live source checks run on the Payload server. Credentials never enter the browser, GitHub, or shared planning records.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 max-w-5xl">
      <div className="bg-white border border-brand-black">
        <div className="px-8 py-6 border-b border-brand-light-gray">
          <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider mb-4">Asana · live activities</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Board</span>
              <span className="font-mono text-xs text-brand-black">Marketing Calendar</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Activities</span>
              <span className="font-mono text-xs text-brand-black">{asana.data?.activities.length ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Last synced</span>
              <span className="font-mono text-xs text-brand-black">{asana.data ? fmtSynced(asana.data.fetchedAt) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Source</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-brand-black">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${asana.status === "live" ? "bg-brand-dark-green" : "bg-brand-hot-red"}`} />
                {asana.status === "live" ? "Live · Asana API" : asana.status}
              </span>
            </div>
          </div>
        </div>
        <div className="px-8 py-5 bg-white border-t border-brand-light-gray">
          <p className="font-mono text-xs text-brand-medium-gray leading-relaxed">
            {asana.detail ?? "Refreshes automatically every five minutes. No static activity snapshot is used."}
          </p>
          <button onClick={() => void asana.refresh()} className="font-mono text-xs underline mt-3">Refresh now</button>
        </div>
      </div>

      <div className="bg-white border border-brand-black">
        <div className="px-8 py-6 border-b border-brand-light-gray">
          <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider mb-4">Hex · governed outputs</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs text-brand-medium-gray">Project</span>
              <a href={hex.data?.projectUrl ?? "https://app.hex.tech/figma/app/Marketing-Campaign-Forecaster-WIP-034OglsR9JAGWYwQZ91DjJ/latest"} target="_blank" rel="noreferrer" className="font-mono text-xs underline text-right">Marketing Campaign Forecaster WIP</a>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Source gate</span>
              <span className="font-mono text-xs text-brand-black">{hex.data?.feed.semanticSourceGate ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">DS validation</span>
              <span className="font-mono text-xs text-brand-black">{hex.data?.feed.dsValidationStatus ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Status</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-brand-black">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${hex.status === "live" ? "bg-brand-dark-green" : "bg-brand-hot-red"}`} />
                {hex.status === "live" ? "Live · approved feed" : hex.status}
              </span>
            </div>
          </div>
        </div>
        <div className="px-8 py-5 bg-white border-t border-brand-light-gray">
          <p className="font-mono text-xs text-brand-medium-gray leading-relaxed">
            {hex.detail ?? (hex.data?.forecastUsable ? "Forecast release gates passed." : "Live outputs received; forecast remains quarantined until its release gates pass.")}
          </p>
          <button onClick={() => void hex.refresh()} className="font-mono text-xs underline mt-3">Refresh now</button>
        </div>
      </div>
      </div>
    </div>
  )
}

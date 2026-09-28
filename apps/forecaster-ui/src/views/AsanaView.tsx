import asanaCache from "../data/asana-cache.json"

interface AsanaCacheFile {
  syncedAt: string
  source: string
  activities: { id: string }[]
}

const CACHE = asanaCache as AsanaCacheFile

function fmtSynced(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function AsanaView() {
  return (
    <div>
      <div className="mb-10">
        <p className="font-mono text-xs text-brand-medium-gray tracking-widest uppercase mb-3">Data · Asana</p>
        <h1 className="text-5xl tracking-tight mb-3">Asana connection</h1>
        <p className="text-brand-medium-gray max-w-xl leading-relaxed text-[15px]">
          Activity data is fetched directly from Asana via Claude MCP and bundled with the app. No Personal Access Token is needed in the browser.
        </p>
      </div>

      <div className="bg-white border border-brand-black max-w-xl">
        <div className="px-8 py-6 border-b border-brand-light-gray">
          <p className="font-mono text-xs text-brand-medium-gray uppercase tracking-wider mb-4">Current data</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Board</span>
              <span className="font-mono text-xs text-brand-black">Mktg Calendar</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Activities</span>
              <span className="font-mono text-xs text-brand-black">{CACHE.activities.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Last synced</span>
              <span className="font-mono text-xs text-brand-black">{fmtSynced(CACHE.syncedAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-brand-medium-gray">Source</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-brand-black">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-dark-green" />
                Claude MCP
              </span>
            </div>
          </div>
        </div>
        <div className="px-8 py-5 bg-white border-t border-brand-light-gray">
          <p className="font-mono text-xs text-brand-medium-gray leading-relaxed">
            To refresh: ask Claude to{" "}
            <span className="bg-[#FAFAFA] border border-brand-light-gray px-1.5 py-0.5 inline-block">
              sync Asana activities
            </span>{" "}
            in this chat.
          </p>
        </div>
      </div>
    </div>
  )
}

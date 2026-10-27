const baseUrl = (
  process.env.PAYLOAD_STAGING_URL ??
  "https://marketing-forecast-tool-staging.pung.site"
).replace(/\/$/, "")
const machineToken = process.env.PAYLOAD_OKTA_BYPASS_TOKEN?.trim()
const syncSecret = process.env.HEX_SYNC_SECRET?.trim()

function stop(message) {
  console.error(`Hex bridge check: ${message}`)
  process.exit(1)
}

if (!machineToken) stop("PAYLOAD_OKTA_BYPASS_TOKEN is missing")
if (!syncSecret) stop("HEX_SYNC_SECRET is missing")

let response
try {
  response = await fetch(`${baseUrl}/api/integrations/hex/ingest`, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${syncSecret}`,
      "X-Figma-Okta-Auth": machineToken,
    },
  })
} catch (error) {
  stop(error instanceof Error ? error.message : "the staging endpoint could not be reached")
}

if (response.status >= 300 && response.status < 400) {
  stop("the Okta machine credential was rejected or was issued for a different site")
}

const contentType = response.headers.get("content-type") ?? ""
if (!contentType.includes("application/json")) {
  stop(`expected JSON but received ${contentType || "an unknown response"}`)
}

const body = await response.json()
if (response.status === 401) {
  stop("the app sync secret was rejected")
}

console.log(
  JSON.stringify(
    {
      httpStatus: response.status,
      status: body.status ?? "unknown",
      receiverEnabled: body.ingestEnabled ?? false,
      syncSecretConfigured: body.syncSecretConfigured ?? false,
      latestSnapshotReceived: Boolean(body.latestSnapshot),
      detail: body.detail ?? null,
    },
    null,
    2,
  ),
)

if (response.status !== 200 || body.status !== "ready") process.exit(1)

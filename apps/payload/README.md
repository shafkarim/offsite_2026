# Marketing Campaign Forecaster — Payload migration

Internal, staging-only Payload application for collaborative marketing-sourced pipeline planning.

## Safety boundary

- Figma staging only.
- Do not initialize, upload schema, or deploy with `--infra-env production`.
- Do not use a production CMS resource ID.
- Do not add Supabase or a browser-storage fallback.
- Do not store raw lead, contact, web-session, or opportunity-level data.
- Hex and semantic-approved assets remain authoritative for actuals and model outputs.

The application refuses to start when `FIGMA_INFRA_ENV` points anywhere other than `staging`, or
when `FIGMA_CONTENT_API_URL` points at a non-staging content backend. The staging control plane
currently calls its first tenant environment `production`; that internal label does not mean the
app is using Figma production infrastructure.

## Current state

- Connected to the Figma staging CMS project `4e3f3721-aba0-4513-a33d-38c56be0a61c`.
- Staging application: <https://marketing-forecast-tool-staging.pung.site>
- The frontend build and staging deployment complete successfully.
- Payload collection schemas are published to the staging content service, including a protected
  system-only collection for governed aggregate snapshots.
- No existing forecast records or sensitive source extracts have been imported yet.
- A staging-specific CMS resource ID is required before schema upload or deployment.

## Two-provider forecast architecture

The application keeps one collaboration layer and two interchangeable evidence providers:

- `FORECAST_DATA_MODE=poc` is the staging default. It serves representative assumptions that make
  the complete planning workflow testable without persisting warehouse-derived actuals or targets.
- `FORECAST_DATA_MODE=governed` reads the latest validated, aggregate-only semantic snapshot from
  the protected system collection. It fails visibly rather than falling back to POC when no valid
  snapshot exists.

Payload remains the collaboration system for planning cycles, scenarios, targets, overrides,
decisions, roles, and audit history. Provider evidence is read separately through
`GET /api/forecast-data`.

## Live source integration

The browser never talks directly to Asana or Hex and never receives their credentials.

- `GET /api/integrations/asana` reads the approved Marketing Calendar from Asana on the server,
  returns only the activity fields required for forecasting, strips owners and notes, and caches
  the response in memory for five minutes. It requires the encrypted staging secret
  `ASANA_ACCESS_TOKEN`.
- `GET /api/forecast-data` selects the configured provider and returns its evidence to authenticated
  users. POC responses are explicitly marked `POC_ASSUMPTIONS` and `POC_ONLY_NOT_FOR_REPORTING`.
- `POST /api/integrations/hex/ingest` is a retained staging proof and is disabled unless
  `HEX_INGEST_ENABLED=true`. It rejects oversized, stale, replayed, malformed, record-level, and
  non-approved payloads. Keep it disabled while the governed provider is being reviewed.
- `GET /api/integrations/hex` remains for compatibility with the earlier transport proof, but the
  user interface no longer reads it.

Configure `ASANA_ACCESS_TOKEN` and `ASANA_MARKETING_CALENDAR_GID` as encrypted staging secrets. Keep
`FORECAST_DATA_MODE=poc` and `HEX_INGEST_ENABLED=false` until the governed path is approved. If the
legacy ingest proof is ever explicitly enabled, configure `HEX_SYNC_SECRET` as an encrypted staging
secret. Configure `FORECAST_OWNER_EMAIL` as an encrypted environment setting to bootstrap the
staging workspace admin. Never put credentials in the frontend, Payload records, GitHub, or a
Figma Make prompt.

## Local validation

```text
npm run generate:types
npx tsc --noEmit
npm run lint
npm run build
```

Local runtime testing also requires an approved local MongoDB connection and a non-production
`PAYLOAD_SECRET`. Never commit either value.

## Figma staging connection

After a staging CMS resource has been created, copy the initialization command from that staging
resource. Verify that the command targets both the staging infrastructure and the `staging`
environment before running it.

Do not run the deploy command until the staging resource is connected, access rules have been
verified, and the user has explicitly approved the staging deployment.

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
- Fifteen Payload collection schemas are published to the staging content service.
- No existing forecast records or sensitive source extracts have been imported yet.
- A staging-specific CMS resource ID is required before schema upload or deployment.

## Live source integration

The browser never talks directly to Asana or Hex and never receives their credentials.

- `GET /api/integrations/asana` reads the approved Marketing Calendar from Asana on the server,
  returns only the activity fields required for forecasting, strips owners and notes, and caches
  the response in memory for five minutes. It requires the encrypted staging secret
  `ASANA_ACCESS_TOKEN`.
- `POST /api/integrations/hex/ingest` accepts aggregate output from the approved Marketing Campaign
  Forecaster project. It requires `Authorization: Bearer <HEX_SYNC_SECRET>` and rejects payloads
  unless `semanticSourceGate=PASS`, `sourceGovernanceStatus=SEMANTIC_APPROVED`, and the approved Hex
  project ID are present.
- `GET /api/integrations/hex` exposes the latest accepted aggregate feed to authenticated app users.
  Forecast output remains quarantined unless DS validation is approved and the release status is
  not blocked.

Configure `ASANA_ACCESS_TOKEN`, `ASANA_MARKETING_CALENDAR_GID`, and `HEX_SYNC_SECRET` as encrypted
secrets in the Figma staging environment. Do not put them in the frontend, Payload records, GitHub,
or a Figma Make prompt.

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

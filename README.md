# Marketing Forecast Tool

Private source repository for the staging-only marketing-sourced pipeline forecast tool.

## Structure

- `apps/forecaster-ui` — the original Figma Make interface and forecasting presentation layer.
- `apps/payload` — Figma Payload authentication, shared planning storage, roles, and deployment configuration.
- `scripts/stage-ui-build.mjs` — copies the built interface into the Payload deployment package.

## Source responsibilities

- **Asana Marketing Calendar:** activity catalogue and operational metadata. Activities remain forecastable when no Salesforce campaign exists.
- **Hex approved semantic outputs:** governed actuals, conversion benchmarks, forecast outputs, model metadata, reconciliation, and release gates.
- **Payload:** collaborative planning inputs, aggregate overrides, notes, decisions, source status, and audit history.

Payload and GitHub must not contain raw lead, contact, web-session, or opportunity-level data. Activity-level Asana snapshots, private extracts, credentials, and imported working files are excluded from Git.

## Local build

1. Install dependencies in both applications.
2. Generate `apps/forecaster-ui/src/data/asana-cache.json` from the approved server-side sync process. For UI-only development, copy `asana-cache.example.json` to that filename.
3. Run `FIGMA_PUBLIC_URL=/forecast npm run build` from the repository root.

The resulting Payload build serves the original interface from `/forecast/` and uses Payload REST endpoints for shared planning state.

## Deployment boundary

Only deploy to Figma staging project `4e3f3721-aba0-4513-a33d-38c56be0a61c` with `--infra-env=staging`. The Payload environment label is `production`, but the infrastructure and public host are staging-only.

## Current integration status

The UI and Payload persistence layer are wired. Live, server-side Asana and Hex synchronisation is the next release gate. Until that is complete, the app must be treated as internal staging and must display source freshness clearly.

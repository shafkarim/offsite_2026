# Hex governed delivery to Payload staging

This is the staging-only handoff for the aggregate forecast feed produced by the approved Hex
project `Marketing Campaign Forecaster WIP`.

## Data boundary

The request may contain only the schema validated by Payload: aggregate channel rates, aggregate
reach values when governed, pacing availability metadata, governance statuses, and refresh
timestamps. It must not contain names, emails, lead/contact/account records, individual web
sessions, individual opportunities, raw SQL, or other record-level data.

## Secrets

Configure these as sensitive values. Never print or commit either value.

- Payload staging: `HEX_SYNC_SECRET`, plus `HEX_INGEST_ENABLED=true`.
- Hex project: the same `HEX_SYNC_SECRET` and the platform-issued `PAYLOAD_OKTA_BYPASS_TOKEN`.

`PAYLOAD_OKTA_BYPASS_TOKEN` is issued by the Figma Cloud/Payload team for the staging endpoint. It
is used only by Hex and does not belong in the Payload environment.

## Delivery cell

Run this only after the existing validator returns `READY`. Keep `V2_DELIVERY_ENABLED = False` for
dry runs. A real delivery is a separate, deliberate run with the flag temporarily set to `True`.

```python
import json
import requests

PAYLOAD_INGEST_URL = (
    "https://marketing-forecast-tool-staging.pung.site"
    "/api/integrations/hex/ingest"
)
V2_DELIVERY_ENABLED = False


def deliver_governed_payload(validated_payload, validation_status):
    if validation_status != "READY":
        return {
            "request_sent": False,
            "delivery_result": "blocked; validation is not READY",
            "http_status": None,
        }

    if not V2_DELIVERY_ENABLED:
        return {
            "request_sent": False,
            "delivery_result": "dry-run; no request sent.",
            "http_status": None,
        }

    if not HEX_SYNC_SECRET or not PAYLOAD_OKTA_BYPASS_TOKEN:
        raise RuntimeError("Required delivery secrets are not attached to the Hex project")

    response = requests.post(
        PAYLOAD_INGEST_URL,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {HEX_SYNC_SECRET}",
            "X-Figma-Okta-Auth": PAYLOAD_OKTA_BYPASS_TOKEN,
        },
        data=json.dumps(validated_payload, separators=(",", ":")),
        timeout=30,
        allow_redirects=False,
    )

    # Record status and a bounded response only. Never record request headers.
    response_text = response.text[:1000]
    return {
        "request_sent": True,
        "delivery_result": "accepted" if response.status_code == 202 else "rejected",
        "http_status": response.status_code,
        "response_body": response_text,
    }
```

For the first controlled delivery, the expected response is HTTP `202` with status `accepted`.
Reset `V2_DELIVERY_ENABLED` to `False` immediately after that run. A `401` from the Figma login page
means the machine credential is missing or incorrect; a JSON `401` means the app-level sync secret
does not match. A JSON `400` means the payload failed schema validation.

After a successful delivery, verify the authenticated readiness endpoint and switch the app to the
governed provider:

1. Open `/api/integrations/hex/ingest` while signed in and confirm `status: ready` plus a non-null
   `latestSnapshot`.
2. Set `FORECAST_DATA_MODE=governed` in Payload staging.
3. Redeploy staging and confirm the UI banner reads `Governed data mode`.

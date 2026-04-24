"""
investran_outbound.py — push Income Calculator output to Investran DIU as
a journal-entry batch.

Reads:
  income-calculator-output-*.json  (produced by buildOutputPayload() in
                                    income-calculator.html, or calculate()
                                    in income-calculator-engine.js)

Writes to Investran DIU:
  1. Resolve the import template GUID by name (templates are provisioned
     by FIS; we never create them ad-hoc).
  2. POST /api/DataImport/v1/batches as multipart/form-data with the CSV
     body and an idempotent externalKey.
  3. Poll /api/DataImport/v1/batches/{id}/status until terminal.
  4. On Failed, dump errors and exit non-zero. Always log traceId.

Idempotency key (external key):
  sha256 digest of (instrumentId, period.begin, period.end, periodRows).
  DIU dedupes on this — re-running the script after a crash will not
  double-post. Change the period OR the rows and a new key is produced.

Why DIU and not direct Accounting POST?
  The investran-apis skill is explicit: "Don't bypass DIU for bulk
  writes. Hitting Accounting POST endpoints in a loop for thousands of
  rows will be slower and less safe than a DIU batch."

Usage:
  export INVESTRAN_BASE_URL=https://investranweb-livedev-us.fiscloudservices.com
  export INVESTRAN_TOKEN=eyJ...

  python investran_outbound.py income-calculator-output-alliance-2026-04-24.json
  python investran_outbound.py *.json --template GL_JOURNAL_V1
  python investran_outbound.py *.json --dry-run          # build the CSV only

Swagger: https://<host>/api/DataImport/v1/swagger/index.html
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
from typing import Any, Dict, List, Optional

from investran_client import InvestranClient, InvestranError

DIU = "/api/DataImport/v1"

DEFAULT_TEMPLATE = "GL_JOURNAL_V1"      # configure per tenant — see DIU Templates
DEFAULT_BATCH_TYPE = "STANDARD"

# Must match the columns the DIU template expects. These match the fields
# the income-calculator engine's generateDIU() already emits.
JE_COLUMNS = [
    "legalEntity", "leid", "batchId", "jeIndex", "txIndex", "glDate",
    "effectiveDate", "deal", "position", "incomeSecurity",
    "transactionType", "account", "allocationRule", "batchType",
    "batchComments", "transactionComments", "originalAmount",
    "amountLE", "fx", "amountLocal", "isDebit", "leDomain",
]


def external_key(payload: Dict[str, Any]) -> str:
    """Deterministic batch key for idempotency. DIU dedupes on this."""
    m = payload["meta"]
    rows = payload.get("periodRows") or payload.get("journalEntries") or []
    h = hashlib.sha256()
    h.update(str(m["instrumentId"]).encode())
    h.update(str(m["period"]["begin"]).encode())
    h.update(str(m["period"]["end"]).encode())
    h.update(json.dumps(rows, sort_keys=True, default=str).encode())
    return f"calc-{m['instrumentId']}-{m['period']['begin']}-{m['period']['end']}-{h.hexdigest()[:10]}"


def je_rows_to_csv(payload: Dict[str, Any]) -> Optional[str]:
    """Serialize journalEntries[] to the CSV shape DIU's GL_JOURNAL template expects."""
    entries: List[Dict[str, Any]] = payload.get("journalEntries") or []
    if not entries:
        return None
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=JE_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for e in entries:
        writer.writerow({c: e.get(c, "") for c in JE_COLUMNS})
    return buf.getvalue()


def resolve_template_id(client: InvestranClient, template_name: str) -> str:
    """Look up a DIU template's GUID by name."""
    for t in client.paginate(f"{DIU}/templates"):
        if t.get("name") == template_name or t.get("code") == template_name:
            return t["id"]
    raise RuntimeError(
        f"DIU template '{template_name}' not found — "
        "check the tenant or pass --template with the correct name."
    )


def submit_batch(
    client: InvestranClient,
    template_id: str,
    csv_text: str,
    ext_key: str,
    batch_type: str,
    comments: str,
) -> str:
    files = {"file": (f"{ext_key}.csv", csv_text.encode(), "text/csv")}
    data = {
        "templateId": template_id,
        "externalKey": ext_key,
        "batchType": batch_type,
        "batchComments": comments or "Posted by income-calculator",
    }
    res = client.post(f"{DIU}/batches", files=files, data=data)
    return res.get("batchId") or res["id"]


def post_payload(
    client: Optional[InvestranClient],
    payload: Dict[str, Any],
    template_name: str = DEFAULT_TEMPLATE,
    batch_type: str = DEFAULT_BATCH_TYPE,
    dry_run: bool = False,
) -> Dict[str, Any]:
    csv_text = je_rows_to_csv(payload)
    if not csv_text:
        return {"skipped": True, "reason": "no journal entries in payload"}
    ext_key = external_key(payload)

    if dry_run:
        return {
            "dryRun": True,
            "externalKey": ext_key,
            "rows": csv_text.count("\n") - 1,
            "templateName": template_name,
            "preview": csv_text[:500],
        }

    assert client is not None
    template_id = resolve_template_id(client, template_name)
    batch_id = submit_batch(
        client,
        template_id,
        csv_text,
        ext_key,
        batch_type,
        comments=str(payload["meta"].get("instrumentId", "")),
    )
    final = client.wait_for(f"{DIU}/batches/{batch_id}/status")
    return {
        "batchId": batch_id,
        "externalKey": ext_key,
        "status": final.get("status") or final.get("state"),
        "rowsAccepted": final.get("rowsAccepted"),
        "rowsRejected": final.get("rowsRejected"),
        "errors": final.get("errors"),
    }


def main():
    ap = argparse.ArgumentParser(description="Push calculator output → Investran DIU")
    ap.add_argument("paths", nargs="+", help="One or more income-calculator-output-*.json files")
    ap.add_argument("--template", default=DEFAULT_TEMPLATE, help=f"DIU template name (default {DEFAULT_TEMPLATE})")
    ap.add_argument("--batch-type", default=DEFAULT_BATCH_TYPE, help=f"DIU batchType (default {DEFAULT_BATCH_TYPE})")
    ap.add_argument("--dry-run", action="store_true", help="Build CSV + external key but do NOT POST")
    args = ap.parse_args()

    client = None if args.dry_run else InvestranClient()
    rc = 0
    for path in args.paths:
        with open(path) as f:
            payload = json.load(f)
        try:
            result = post_payload(client, payload, args.template, args.batch_type, args.dry_run)
        except InvestranError as e:
            print(f"{path}: DIU error {e} (traceId={e.trace_id})", file=sys.stderr)
            rc = 2
            continue
        print(path, "→", json.dumps(result, indent=2, default=str))
        if result.get("status") == "Failed":
            rc = 3
    sys.exit(rc)


if __name__ == "__main__":
    main()

"""
investran_inbound.py — pull reference data from Investran CRM v2 and emit
JSON files in the shape the Income Calculator consumes.

Mapping (CRM → calculator instrument):
  CRM Legal Entity     → instrument.legalEntity (name) + instrument.leid (externalId/code)
  CRM Deal             → instrument.deal
  CRM Position         → instrument.position
  CRM Security         → instrument.incomeSecurity  (and instrument.id)
  CRM Security.details → faceValue, purchasePrice, commitment, settlementDate,
                         maturityDate, dayBasis, coupon{}, pik{}, nonUseFee{},
                         amortization{}, principalSchedule[]

Outputs:
  <out>/instruments-from-investran.json     bundle of all instruments
  <out>/instruments/<id>.json               per-security payload in the exact
                                            shape the HTML's "Import JSON"
                                            button accepts

Usage:
  export INVESTRAN_BASE_URL=https://investranweb-livedev-us.fiscloudservices.com
  export INVESTRAN_TOKEN=eyJ...

  python investran_inbound.py --le-id <GUID> --out ./data
  python investran_inbound.py --all-les        --out ./data
  python investran_inbound.py --all-les --as-of 2026-04-30 --out ./data

Swagger: https://<host>/api/ReferenceData/v2/swagger/index.html
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from typing import Any, Dict, List, Optional

from investran_client import InvestranClient, InvestranError

CRM = "/api/ReferenceData/v2"
ACC = "/api/Accounting/v1"

# Normalize CRM's day-count spellings to the calculator's enum.
DAYBASIS_MAP = {
    "ACT/360": "ACT/360", "Actual/360": "ACT/360", "A/360": "ACT/360", "ACT360": "ACT/360",
    "ACT/365": "ACT/365", "Actual/365": "ACT/365", "A/365": "ACT/365", "ACT365": "ACT/365",
    "ACT/ACT": "ACT/ACT", "Actual/Actual": "ACT/ACT", "ACTACT": "ACT/ACT",
    "30/360": "30/360", "30_360": "30/360", "ThirtyThreeSixty": "30/360",
}


def _get(d: Dict[str, Any], *keys, default=None):
    """Tolerant field lookup — CRM responses sometimes vary on casing/nesting."""
    for k in keys:
        if d is None:
            return default
        if k in d and d[k] is not None:
            return d[k]
    return default


def map_security(leid, le_name, deal, position, sec) -> Dict[str, Any]:
    coupon = sec.get("coupon") or {}
    amort = sec.get("amortization") or {}
    pik = sec.get("pik") or {}
    fee = sec.get("nonUseFee") or {}

    face = _get(sec, "faceValue", "face", "notional", default=0)
    price = _get(sec, "purchasePrice", "costBasis", "price", default=face)
    commit = _get(sec, "commitment", "commitmentAmount", default=face)

    return {
        "id": _get(sec, "id", "securityId", "externalId"),
        "legalEntity": le_name,
        "leid": leid,
        "deal": _get(deal, "name", "dealName"),
        "position": _get(position, "name", "positionName"),
        "incomeSecurity": _get(sec, "name", "securityName"),
        "faceValue": face,
        "purchasePrice": price,
        "commitment": commit,
        "settlementDate": _get(sec, "settlementDate", "startDate", "effectiveDate"),
        "maturityDate": _get(sec, "maturityDate", "endDate"),
        "accrualDayCountExclusive": bool(_get(sec, "accrualDayCountExclusive", default=False)),
        "paydateDayCountInclusive": bool(_get(sec, "paydateDayCountInclusive", default=True)),
        "interestPreviousDay": bool(_get(sec, "interestPreviousDay", default=False)),
        "dayBasis": DAYBASIS_MAP.get(_get(sec, "dayBasis", "dayCount", default="") or "", "ACT/360"),
        "coupon": {
            "type": _get(coupon, "type", default="Fixed"),
            "fixedRate": _get(coupon, "fixedRate", "rate", default=0) or 0,
            "floatingRate": _get(coupon, "floatingRate", default=0) or 0,
            "spread": _get(coupon, "spread", default=0) or 0,
            "floor": _get(coupon, "floor"),
            "cap": _get(coupon, "cap"),
        },
        "pik": {
            "enabled": bool(_get(pik, "enabled", default=False)),
            "rate": _get(pik, "rate", default=0) or 0,
            "capitalizationFrequency": _get(pik, "capitalizationFrequency", "frequency", default="Monthly"),
        },
        "nonUseFee": {
            "enabled": bool(_get(fee, "enabled", default=False)),
            "rate": _get(fee, "rate", default=0) or 0,
        },
        "amortization": {
            "method": _get(amort, "method", default="none"),
            "startDate": _get(amort, "startDate"),
            "endDate": _get(amort, "endDate"),
        },
        "principalRepayment": _get(sec, "principalRepayment", default="AtMaturity"),
        "principalSchedule": _get(sec, "principalSchedule")
        or [{"date": _get(sec, "settlementDate"), "type": "initial", "amount": face or 0}],
        "type": _get(sec, "investranType", "calculatorType", default="fixedCouponNoAmort"),
        "preset": f"{_get(deal, 'name', default='') or ''} · {_get(sec, 'name', default='') or ''}".strip(" ·"),
    }


# --- CRM walk ---------------------------------------------------------------

def fetch_all(client: InvestranClient, le_id: Optional[str] = None, as_of: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Walk CRM: Legal Entity → Deal → Position → Security.
    Endpoint paths are the standard CRM v2 shapes; adjust per tenant swagger
    if your instance exposes different nesting.
    """
    if le_id:
        les = [client.get(f"{CRM}/legalentities/{le_id}")]
    else:
        les = list(client.paginate(f"{CRM}/legalentities"))

    instruments: List[Dict[str, Any]] = []
    params_asof = {"asOf": as_of} if as_of else None

    for le in les:
        le_guid = le["id"]
        le_name = _get(le, "name", "legalEntityName")
        leid = _get(le, "externalId", "code", default=0)

        for deal in client.paginate(f"{CRM}/legalentities/{le_guid}/deals"):
            for position in client.paginate(f"{CRM}/deals/{deal['id']}/positions"):
                for sec in client.paginate(
                    f"{CRM}/positions/{position['id']}/securities",
                    params=params_asof,
                ):
                    instruments.append(map_security(leid, le_name, deal, position, sec))

    return instruments


# --- Emit to disk -----------------------------------------------------------

def _crm_envelope(inst: Dict[str, Any], today: str) -> Dict[str, Any]:
    """Wrap a flattened instrument in the Investran CRM v2 envelope the HTML
    calculator's Import JSON button expects. Mirrors investran-crm-input.sample.json."""
    return {
        "api": "ReferenceData/v2",
        "endpoint": "/positions/{positionId}/securities",
        "legalEntity": {"id": None, "externalId": inst.get("leid"), "name": inst.get("legalEntity")},
        "deal":        {"id": None, "name": inst.get("deal")},
        "position":    {"id": None, "name": inst.get("position")},
        "period": {
            "begin": inst.get("settlementDate") or today,
            "end":   today,
            "last":  None,
        },
        "security": {
            "id":             inst.get("id"),
            "name":           inst.get("incomeSecurity"),
            "investranType":  inst.get("type"),
            "faceValue":      inst.get("faceValue"),
            "purchasePrice":  inst.get("purchasePrice"),
            "commitment":     inst.get("commitment"),
            "currency":       "USD",
            "settlementDate": inst.get("settlementDate"),
            "maturityDate":   inst.get("maturityDate"),
            "dayBasis":       inst.get("dayBasis"),
            "accrualDayCountExclusive": inst.get("accrualDayCountExclusive"),
            "paydateDayCountInclusive": inst.get("paydateDayCountInclusive"),
            "interestPreviousDay":      inst.get("interestPreviousDay"),
            "coupon":             inst.get("coupon"),
            "pik":                inst.get("pik"),
            "nonUseFee":          inst.get("nonUseFee"),
            "principalRepayment": inst.get("principalRepayment"),
            "principalSchedule":  inst.get("principalSchedule"),
            "amortization":       inst.get("amortization"),
        },
    }


def emit(instruments: List[Dict[str, Any]], out_dir: str):
    os.makedirs(out_dir, exist_ok=True)

    bundle_path = os.path.join(out_dir, "instruments-from-investran.json")
    with open(bundle_path, "w") as f:
        json.dump({"instruments": instruments}, f, indent=2, default=str)

    per_dir = os.path.join(out_dir, "instruments")
    os.makedirs(per_dir, exist_ok=True)
    today = date.today().isoformat()
    for inst in instruments:
        payload = _crm_envelope(inst, today)
        fname = (inst.get("id") or inst.get("incomeSecurity") or "unknown").replace("/", "_")
        with open(os.path.join(per_dir, f"{fname}.json"), "w") as f:
            json.dump(payload, f, indent=2, default=str)

    return bundle_path, per_dir


# --- Entry point ------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Pull Investran CRM v2 → Income Calculator JSON")
    ap.add_argument("--le-id", help="Single legal entity GUID (omit for --all-les)")
    ap.add_argument("--all-les", action="store_true", help="Walk all legal entities")
    ap.add_argument("--as-of", help="As-of date for security attributes (YYYY-MM-DD)")
    ap.add_argument("--out", default="./out", help="Output directory (default ./out)")
    args = ap.parse_args()
    if not (args.le_id or args.all_les):
        ap.error("one of --le-id or --all-les is required")

    client = InvestranClient()
    try:
        instruments = fetch_all(client, le_id=args.le_id, as_of=args.as_of)
    except InvestranError as e:
        print(f"CRM fetch failed: {e} (traceId={e.trace_id})", file=sys.stderr)
        sys.exit(2)

    bundle, per_dir = emit(instruments, args.out)
    print(f"Wrote {len(instruments)} instruments")
    print(f"  bundle   : {bundle}")
    print(f"  per-inst : {per_dir}/")


if __name__ == "__main__":
    main()

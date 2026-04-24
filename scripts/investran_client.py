"""
investran_client.py — shared client for FIS Investran REST APIs

Handles base URL, bearer-token auth, JSON serialization, pagination,
async job polling, and error normalization. Compatible with all seven
modules from the investran-apis skill:

  Code  Module                       Path prefix
  ----  --------------------------   -----------
  RW    Report Wizard                /api/ReportWizard/v1
  DIU   Data Import Utility          /api/DataImport/v1
  CRM   Reference Data (CRM)         /api/ReferenceData/v2
  RM    Report Manager               /api/ReportManager/v1
  ACC   Accounting                   /api/Accounting/v1
  ARM   Allocation Rule Manager      /api/AllocationRuleManager/v1
  ATM   Active Template Manager      /api/ActiveTemplateManagerUI/v1

Environment variables:
  INVESTRAN_BASE_URL   default: https://investranweb-livedev-us.fiscloudservices.com
  INVESTRAN_TOKEN      bearer token (required; treat as a secret)

Usage:
    from investran_client import InvestranClient
    c = InvestranClient()
    for inv in c.paginate("/api/ReferenceData/v2/investors"):
        print(inv["id"], inv["name"])
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, Iterator, Optional

import requests

logger = logging.getLogger("investran")


class InvestranError(Exception):
    """Normalized Investran error. Always carries the traceId for FIS support."""

    def __init__(self, status: int, errors: Any, trace_id: Optional[str] = None, body: Optional[str] = None):
        self.status = status
        self.errors = errors
        self.trace_id = trace_id
        self.body = body
        super().__init__(f"Investran {status}: {errors} (traceId={trace_id})")


class InvestranClient:
    DEFAULT_BASE = "https://investranweb-livedev-us.fiscloudservices.com"

    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        timeout: float = 60.0,
        max_retries: int = 3,
    ):
        self.base_url = (base_url or os.environ.get("INVESTRAN_BASE_URL") or self.DEFAULT_BASE).rstrip("/")
        tok = token or os.environ.get("INVESTRAN_TOKEN")
        if not tok:
            raise RuntimeError(
                "INVESTRAN_TOKEN env var is required (or pass token=). "
                "Never hardcode tokens — read from env or a secret manager."
            )
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {tok}",
                "Accept": "application/json",
            }
        )
        self.timeout = timeout
        self.max_retries = max_retries

    # ---------- core request ----------
    def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Any] = None,
        files: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Any:
        url = self.base_url + (path if path.startswith("/") else "/" + path)
        for attempt in range(1, self.max_retries + 1):
            resp = self.session.request(
                method,
                url,
                params=params,
                json=json_body if files is None else None,
                files=files,
                data=data,
                timeout=self.timeout,
            )
            if resp.status_code < 400:
                if resp.status_code == 204 or not resp.content:
                    return None
                ctype = resp.headers.get("Content-Type", "")
                if "application/json" in ctype:
                    return resp.json()
                return resp.content

            # Retry on 429 and 5xx
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < self.max_retries:
                backoff = min(2 ** attempt, 30)
                retry_after = float(resp.headers.get("Retry-After") or backoff)
                logger.warning(
                    "Retryable %s on %s %s (attempt %d); sleeping %.1fs",
                    resp.status_code,
                    method,
                    path,
                    attempt,
                    retry_after,
                )
                time.sleep(retry_after)
                continue

            # Normalize error envelope: { errors[], traceId, status, title }
            trace_id = None
            errors: Any = resp.text
            try:
                env = resp.json()
                trace_id = env.get("traceId")
                errors = env.get("errors") or env.get("title") or env
            except Exception:
                pass
            raise InvestranError(resp.status_code, errors, trace_id, body=resp.text)

        raise RuntimeError("unreachable retry loop")

    def get(self, path, **kw):
        return self.request("GET", path, **kw)

    def post(self, path, **kw):
        return self.request("POST", path, **kw)

    def put(self, path, **kw):
        return self.request("PUT", path, **kw)

    def delete(self, path, **kw):
        return self.request("DELETE", path, **kw)

    # ---------- pagination ----------
    def paginate(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        page_size: int = 200,
    ) -> Iterator[Dict[str, Any]]:
        """
        Iterate a list endpoint. Investran list responses are either:
          { items: [...], totalCount, pageNumber, pageSize }
        or a plain array for unpaginated resources.
        """
        p: Dict[str, Any] = dict(params or {})
        p.setdefault("pageNumber", 1)
        p.setdefault("pageSize", page_size)
        while True:
            envelope = self.get(path, params=p)
            if isinstance(envelope, list):
                yield from envelope
                return
            items = envelope.get("items") or []
            for it in items:
                yield it
            total = envelope.get("totalCount", 0)
            if p["pageNumber"] * p["pageSize"] >= total or not items:
                return
            p["pageNumber"] += 1

    # ---------- async polling ----------
    def wait_for(
        self,
        status_path: str,
        *,
        terminal=("Completed", "Failed", "Cancelled", "Succeeded"),
        interval: float = 5.0,
        timeout: float = 1800.0,
    ) -> Dict[str, Any]:
        """
        Poll a <resource>/{id}/status endpoint until it reports a terminal state.
        Used for RW executions, DIU batches, and ARM rule applications.
        """
        deadline = time.monotonic() + timeout
        while True:
            s = self.get(status_path)
            state = (s.get("status") or s.get("state") or "").strip()
            if state in terminal:
                return s
            if time.monotonic() > deadline:
                raise TimeoutError(
                    f"Polling {status_path} exceeded {timeout}s (last state: {state!r})"
                )
            time.sleep(interval)


__all__ = ["InvestranClient", "InvestranError"]

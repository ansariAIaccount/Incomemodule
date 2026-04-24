# Investran Interfaces — Income Calculator

Two Python adapters connect the Income Calculator to FIS Investran, built against the `investran-apis` skill's module table.

| Direction | Module | Path prefix | Script |
|-----------|--------|-------------|--------|
| Inbound   | CRM v2 (Reference Data) | `/api/ReferenceData/v2` | `scripts/investran_inbound.py` |
| Outbound  | DIU (Data Import Utility) | `/api/DataImport/v1`     | `scripts/investran_outbound.py` |
| Shared    | Bearer-auth HTTP client | —                         | `scripts/investran_client.py` |

Default tenant: `https://investranweb-livedev-us.fiscloudservices.com` (livedev-us). Override with `INVESTRAN_BASE_URL`.

## Setup

```bash
pip install requests

export INVESTRAN_BASE_URL="https://investranweb-livedev-us.fiscloudservices.com"
export INVESTRAN_TOKEN="eyJ..."   # bearer token — read from env, never commit
```

Token acquisition is tenant-specific and goes through the FIS OAuth endpoint. Treat tokens like passwords — env vars or a secret manager only, never code or notebooks.

Swagger (authoritative):
- CRM: `https://<host>/api/ReferenceData/v2/swagger/index.html`
- DIU: `https://<host>/api/DataImport/v1/swagger/index.html`

## Inbound — CRM v2 → Calculator JSON

`investran_inbound.py` walks the CRM hierarchy Legal Entity → Deal → Position → Security and emits instruments in the calculator's shape.

```bash
# One legal entity
python scripts/investran_inbound.py --le-id <LE_GUID> --out ./data

# All legal entities with an as-of date
python scripts/investran_inbound.py --all-les --as-of 2026-04-30 --out ./data
```

Outputs:

| File | Purpose |
|------|---------|
| `data/instruments-from-investran.json` | Bundle: `{ instruments: [...] }` — all securities in one file |
| `data/instruments/<id>.json` | Per-security payload: `{ instrument, period }` — loads directly via the calculator's "Import JSON" button |

Field map (CRM → calculator):

```
legalEntities[].id / name / externalId   → instrument.legalEntity / leid
deals[].name                             → instrument.deal
positions[].name                         → instrument.position
securities[].name / id                   → instrument.incomeSecurity / id
securities[].faceValue                   → instrument.faceValue
securities[].purchasePrice               → instrument.purchasePrice
securities[].commitment                  → instrument.commitment
securities[].settlementDate              → instrument.settlementDate
securities[].maturityDate                → instrument.maturityDate
securities[].dayBasis                    → instrument.dayBasis   (normalized)
securities[].coupon{}                    → instrument.coupon{}
securities[].pik{}                       → instrument.pik{}
securities[].nonUseFee{}                 → instrument.nonUseFee{}
securities[].amortization{}              → instrument.amortization{}
securities[].principalSchedule[]         → instrument.principalSchedule[]
                                           (defaults to single 'initial' event
                                            at settlementDate if absent)
```

The day-count normalizer accepts `ACT/360`, `Actual/360`, `A/360`, `ACT360` → `ACT/360`, and the equivalents for 365, ACT/ACT, 30/360.

Pagination is handled by `client.paginate()` — `pageSize=200`, follows `totalCount`.

## Outbound — Calculator JSON → DIU Batch

`investran_outbound.py` posts one or more calculator output files to DIU as journal-entry batches.

```bash
# Single file
python scripts/investran_outbound.py income-calculator-output-alliance-2026-04-24.json

# Glob, custom template
python scripts/investran_outbound.py outputs/*.json --template GL_JOURNAL_V1

# Dry run — build the CSV + external key but don't POST
python scripts/investran_outbound.py outputs/*.json --dry-run
```

Pipeline per file:

1. **Resolve template** — GET `/api/DataImport/v1/templates`, match on name → GUID. Templates are provisioned by FIS, not created ad-hoc.
2. **Compute external key** — `sha256(instrumentId || period.begin || period.end || periodRows)`. DIU dedupes on this, so re-running after a crash never double-posts.
3. **POST `/api/DataImport/v1/batches`** — multipart: `file` (the CSV under `JE_COLUMNS`), `templateId`, `externalKey`, `batchType`, `batchComments`. Response yields `batchId`.
4. **Poll `/api/DataImport/v1/batches/{id}/status`** — `client.wait_for()` polls every 5 s up to 30 min, watching for terminal states `Completed | Failed | Cancelled | Succeeded`.
5. **On Failed** — dump `errors[]` and `traceId`, exit non-zero. FIS support uses `traceId` for tickets.

CSV columns (must match the DIU template — these mirror the calculator engine's `generateDIU()`):

```
legalEntity, leid, batchId, jeIndex, txIndex, glDate, effectiveDate,
deal, position, incomeSecurity, transactionType, account, allocationRule,
batchType, batchComments, transactionComments, originalAmount, amountLE,
fx, amountLocal, isDebit, leDomain
```

GL accounts emitted (standard PE back-office chart, adjust per tenant):

| Account | Transaction type |
|---------|------------------|
| 40100   | Interest Income |
| 23000   | Interest Receivable |
| 40150   | PIK Capitalization |
| 40200   | Non-use Fee Income |
| 23100   | Fee Receivable |

## Error handling

All errors raise `InvestranError` carrying `status`, `errors[]`, and `traceId`. The adapters log the traceId on non-zero exit; FIS support needs it to diagnose.

Retryable statuses (429, 500, 502, 503, 504) are retried automatically with exponential backoff (capped at 30 s, honors `Retry-After`). 4xx errors are raised immediately.

## Idempotency

The outbound adapter's external key is deterministic, so:

- Re-running after a transient failure re-submits the same key — DIU rejects the duplicate, the batch status is re-polled, no double-post.
- Changing the accrual period or any row contents produces a new key — a fresh batch is created.
- Changing only commentary / metadata does **not** change the key — intentional, so cosmetic re-runs don't flood DIU.

## Observability checklist

Every integration run should log:

- `batchId` (from DIU) — resume point for status re-polls after a crash.
- `externalKey` — idempotency key, useful for reconciliation against DIU's batch listing.
- `traceId` on any `InvestranError` — required for FIS support tickets.
- Final `status`, `rowsAccepted`, `rowsRejected` per batch.

## What's next

- **Scheduled job** — wrap inbound + calculation (Node-invoked engine) + outbound in a single entry point, run nightly.
- **ARM integration** — if allocation rules need to be applied before posting, add a step 2.5 hitting `/api/AllocationRuleManager/v1/rules/{id}/apply` with `wait_for`.
- **RM (Report Manager)** — if outputs should be distributed as scheduled PDFs, register a managed report pointing at the DIU batch roll-up.

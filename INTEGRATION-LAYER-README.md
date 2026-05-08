# Loan Module Integration Layer

A new self-contained module that orchestrates the **PortF → PCS / Investran → Workday → Reconciliation → PortF Feedback** pipeline. Aligns to the architecture in *PortF · NWF Workshop · 2026* (slides 11-12, 24-25).

> **The original Loan Module is preserved** at `income-calculator.html`. The Integration Layer lives at `loan-module-integration-layer.html` and shares the same calculation engine and instrument dataset via two extracted scripts (`loan-module-engine.js`, `loan-module-instruments.js`) so we have one source of truth.

## File map

| File | Purpose |
|---|---|
| `income-calculator.html` | Original Loan Module (unchanged — full-feature calculator) |
| **`loan-module-integration-layer.html`** | New 5-stage pipeline module |
| `loan-module-engine.js` | Shared engine: `buildSchedule`, `summarize`, `generateDIU`, `INVESTRAN_GL`, etc. |
| `loan-module-instruments.js` | Shared `INSTRUMENTS` dataset (13 seed deals) |
| `INTEGRATION-LAYER-README.md` | This file |

## The five-stage pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│  STAGE 1 · PortF Inbound                                             │
│  ───────────────────────────────                                     │
│  PortF is the System of Record. Owns:                                │
│    • Deal capture & versioning                                       │
│    • Cashflows, fees, ratchets                                       │
│    • Workflows & approvals                                           │
│    • Reporting & dashboards                                          │
│  → Sends a canonical setup + accrualSchedule[] payload               │
└──────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────┐
│  STAGE 2 · PCS / Investran — Accounting Engine                       │
│  ───────────────────────────────                                     │
│  Translates PortF cashflows into IFRS-aligned accounting:            │
│    • IFRS 9 §5.1 Initial Recognition (AmortisedCost / FVOCI / FVTPL) │
│    • IFRS 9 §B5.4 Effective Interest Rate                            │
│    • IFRS 13 Fair Value (where applicable)                           │
│    • IFRS 15 fee revenue (over-time / point-in-time)                 │
│    • IFRS 9 §5.5 ECL provisioning                                    │
│    • IFRS 9 §5.4.3 modifications                                     │
│    • IFRS 9 §6 hedge accounting                                      │
│  → Outputs balanced double-entry journals mapped to Investran chart  │
└──────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────┐
│  STAGE 3 · Workday Outbound (DIU)                                    │
│  ───────────────────────────────                                     │
│  Pushes journals to Workday GL via FIS Investran's Data Import       │
│  Utility (DIU). Carries:                                             │
│    • Deterministic externalKey (idempotent retries)                  │
│    • Balance check (DR == CR)                                        │
│    • templateId, batchType, run metadata                             │
│  → Workday accepts batch, posts to GL                                │
└──────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────┐
│  STAGE 4 · Workday Inbound (Actuals)                                 │
│  ───────────────────────────────                                     │
│  Workday returns actual cash settlements after the period closes:    │
│    • Real interest received                                          │
│    • Real drawdowns funded                                           │
│    • Real fees received                                              │
│    • Status: POSTED / CANCELLED / FAILED                             │
└──────────────────────────────────────────────────────────────────────┘
                                ↓
┌──────────────────────────────────────────────────────────────────────┐
│  STAGE 5 · Reconciliation + PortF Feedback                           │
│  ───────────────────────────────                                     │
│  Compares PCS expected cash vs Workday actuals line-by-line:         │
│    • tied      — within absolute tolerance (£1)                      │
│    • within    — Δ% ≤ 0.5% break threshold                           │
│    • break     — > threshold or missing/cancelled                    │
│  → Builds PortF feedback JSON with break details + actions           │
│  → On clean reconciliation: confirms period as RECONCILED            │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ↓
                     POST /api/integration/feedback
                                │
                                ↓
                         Back to PortF for
                       deal-team investigation
```

## Data contracts

### Stage 1 — PortF cashflow payload (POST in)

```json
{
  "source": "PortF v2026.05",
  "exportedAt": "2026-04-30T16:00:00Z",
  "instrument": {
    "id": "libra2",
    "legalEntity": "NWF Sustainable Infrastructure",
    "deal": "Libra 2",
    "position": "NWF 100% Bilateral Position · Libra 2",
    "incomeSecurity": "HSBC Facility B4 — Libra 2 ...",
    "currency": "GBP",
    "faceValue": 25000000,
    "commitment": 25000000,
    "settlementDate": "2024-10-08",
    "maturityDate": "2031-10-10",
    "coupon": { "type":"SONIA", ... },
    "ifrs": {
      "ifrs9Classification": "AmortisedCost",
      "sppiPassed": true,
      "businessModel": "HoldToCollect",
      "ecLStage": 1,
      "pdAnnual": 0.005,
      "lgd": 0.40
    }
  },
  "accrualSchedule": [
    { "date": "2024-10-13", "balance": 0, "draw": 0, "currentRate": 0.09,
      "dailyInterest": 0, "dailyFees": 437500, "feeBreakdown": { "Arrangement Fee": 437500 } },
    ...
  ]
}
```

### Stage 3 — DIU batch envelope (POST out)

```json
{
  "api": "DataImport/v1",
  "endpoint": "/batches",
  "target": "Workday Financial Management · GL",
  "envelope": {
    "templateId": "...",
    "templateName": "GL_JOURNAL_V1",
    "externalKey": "lmil-libra2-2024-10-08-to-2031-10-10-9b3f2a1c",
    "batchId": "WD-20260507-LIBRA2-4729",
    "batchType": "STANDARD",
    "batchComments": "LMIL · Libra 2 · NWF 100% Bilateral · 2024-10-08-to-2031-10-10",
    "generatedAt": "2026-05-07T...",
    "sourceModule": "Loan Module Integration Layer",
    "pcsSourceVersion": "PCS / Investran v2026"
  },
  "summary": { "jeRows": 18, "totalDebits": ..., "totalCredits": ..., "balanced": true },
  "journalEntries": [ ... ]
}
```

### Stage 4 — Workday actuals payload (POST in)

```json
{
  "source": "Workday Financial Management",
  "batchId": "WD-20260507-LIBRA2-4729",
  "periodStart": "2024-10-08",
  "periodEnd": "2031-10-10",
  "actuals": [
    { "date": "2024-10-13", "transactionType": "Arrangement Fee Cash Receipt",
      "account": "111000", "amountLE": 437500.00, "isDebit": true,
      "workdayJournalId": "WD-JE-10001", "status": "POSTED" },
    ...
  ]
}
```

### Stage 5 — PortF feedback payload (POST out)

```json
{
  "api": "PortF Integration Feedback v1",
  "endpoint": "POST /api/integration/feedback",
  "feedbackType": "RECONCILIATION_BREAKS",
  "generatedAt": "2026-05-07T...",
  "sourceModule": "Loan Module Integration Layer",
  "deal": {
    "instrumentId": "libra2",
    "dealName": "Libra 2",
    "position": "NWF 100% Bilateral Position · Libra 2",
    "legalEntity": "NWF Sustainable Infrastructure"
  },
  "workdayBatchRef": {
    "batchId": "WD-20260507-LIBRA2-4729",
    "externalKey": "lmil-libra2-...",
    "jeRows": 18
  },
  "summary": {
    "cashLinesCompared": 5, "tied": 3, "withinTolerance": 0, "breaks": 2,
    "tieRatePct": 60.00, "netVarianceLE": -500.00, "totalAbsoluteVarianceLE": 437500.50
  },
  "breaks": [
    { "date": "2025-01-10", "transactionType": "Commitment Fee Cash Receipt",
      "account": "111000", "pcsExpected": 88219.18, "workdayActual": 87719.18,
      "varianceLE": -500.00, "variancePct": 0.5667, "reason": "Variance 0.57% > 0.5% threshold",
      "workdayJournalId": "WD-JE-10002",
      "action": "INVESTIGATE — confirm cashflow with PortF deal team" }
  ],
  "actionRequired": true,
  "requestedActions": [
    "Confirm contractual cashflow date / amount with deal team",
    "If cashflow is correct, raise Workday GL ticket to investigate posting",
    "If cashflow needs amendment, create amendment in PortF (versioning preserved)",
    "Trigger Stage 1 → 5 re-run after amendment"
  ]
}
```

## Investran GL chart coverage

Every journal entry produced in Stage 2 is mapped to a real Investran GL account from your updated chart (`NewReport (3).xlsx`). The Stage 2 panel surfaces a coverage summary — green when all transaction types map cleanly, amber when placeholder accounts are used. See `gl-account-gaps.md` for the canonical inventory.

After your latest Investran update, the only remaining gaps are Priority-3 transaction-type-only fixes (fee receivable transtypes, non-use fee income transtype, default interest/fee transtypes). The new accounts you created — 470000, 145000, 360000, 146000, 442000, 451000, 452000, 492100-500 — are all mapped cleanly.

## How to run a demo end-to-end

1. Open `loan-module-integration-layer.html`
2. Pick a deal (e.g., **Libra 2**) in the active-deal dropdown
3. **Stage 1** — click *Use Active Deal as Sample* (or paste a PortF JSON via *Load from PortF*)
4. **Stage 2** — click *Run Accounting* → see classification, EIR, fair value, generated journals
5. **Stage 3** — click *Push DIU to Workday* → see batch ID + externalKey + balance check
6. **Stage 4** — click *Synthesise Sample (with variances)* → loads actuals with 1-2 deliberate breaks
7. **Stage 5** — click *Run Reconciliation* → see tied / within / break breakdown + feedback JSON
8. Click *Send Feedback to PortF* → downloads the feedback JSON ready to POST to PortF's `/api/integration/feedback` endpoint

## What stays where

| Concern | Owner |
|---|---|
| Deal capture, ratchets, fees, drawdowns, cashflow generation | **PortF** |
| IFRS classification, EIR, fair value, journal generation | **PCS / Investran** |
| GL posting, cash settlement, period close | **Workday** |
| Reconciliation between PCS expected and Workday actual | **Loan Module Integration Layer** |
| PD / LGD / EAD models, ECL methodology, RWA, stress testing | **PwC** (data feeds in from PortF; ECL JEs flow through PCS at 470000/145000) |

## Why this architecture

- **No duplication of contractual data** — calculations performed once in PortF, consumed many times.
- **Each team uses a tool built for its job** — Finance Ops in PortF, Accounting in PCS, GL in Workday, Risk in PwC. No forced "one-size-fits-all" platform.
- **Every output traces back to the same versioned deal record in PortF** — when a journal posts, you can drill from the JE → batch → DIU envelope → PCS accounting decision → PortF cashflow → PortF deal version that generated it.
- **Reconciliation breaks become PortF tasks** — the deal team owns the answer (was it the contractual cashflow that was wrong, or the GL posting?), not the accounting team.

## Verified working

Smoke test (2026-05-07) running over Libra 2:

```
Total instruments:    13
Libra 2 schedule:     2,559 daily rows
Generated journals:   18 JE rows
Total interest:       £13,361,596
Cash-leg recon:       5 lines (3 tied · 2 breaks with synthesised variances)
PortF feedback:       2 breaks for investigation
```

The integration layer reuses the same engine functions as the original calculator, so every IFRS treatment (EIR, ECL, FX, modification, hedge accounting) flows through to the Stage 2 journals automatically.

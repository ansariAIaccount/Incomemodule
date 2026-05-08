# Loan Module Integration Layer — User Guide

**Version:** 2026-05-08 (revised)
**File:** `loan-module-integration-layer.html`
**Audience:** PCS / Investran operators, Finance Ops users on the PortF deal team, internal audit, and reviewers from PwC and Workday teams

---

## What's new in this revision

This revision adds live treatment-driven recalculation, a daily-schedule view, contractual override editors, and a corrected month-end close workflow. Highlights:

- **Stage 2 now rebuilds the engine schedule on every Run Accounting** — every treatment or contractual change (PIK, mod events, ECL stage, FV level, fee policy) flows immediately into the journals, KPIs, and Daily Schedule view.
- **New Daily Schedule panel** in Stage 2 shows the engine's per-day output (balance, draw, paydown, rate, interest, PIK, fees, EIR accretion, ECL change, mod gain, FX, hedge P&L). Filterable to "events only", "all days", or "month-end days only". Downloadable as 47-column CSV or as a JSON envelope.
- **Inline modification-events editor** under the Modification Policy section — every cell (date, type, gain/loss, reason) is inline-editable. Buttons inject sample non-substantial / substantial events at mid-life of the deal.
- **Inline PIK editor** (enabled / rate / capitalisation frequency) — overrides the contractual PIK on the active deal. The engine immediately re-computes daily PIK accruals + capitalisation events.
- **Fair Value capability card now lives** — it always reflects the FV Level you choose (Level 1 / 2 / 3), even on amortised-cost deals where FV is a notes-only disclosure (IFRS 7 §25). Lights amber when overridden.
- **FV Sensitivities panel** branches on Level: Level 1 shows price-volatility shocks and disclosure of price source; Level 2 shows ±50 / ±100 bps rate + ±50 bps spread; Level 3 shows stress shocks (±150 bps), illiquidity premium, recovery rate, plus a "significant unobservable inputs" table (IFRS 13 §93(d)).
- **Carrying Value Waterfall** corrected: anchors on opening **carrying value** (not principal balance), itemises deferred IFRS 15 fees at recognition, OID amortisation, modification gain/loss, hedge P&L, FX. ECL is now a memo disclosure block below the waterfall (gross → less ECL → net), reflecting IFRS 9 §5.5 contra-asset presentation.
- **CSV downloads sanitised** — en-dash, em-dash, middle-dot, section-symbol replaced with ASCII; currency symbols swapped for 3-letter codes; UTF-8 BOM prepended; money fields rounded to 2 dp.
- **Month-End workflow "Posted" is terminal** — all four chips turn green, action buttons are replaced with **Unlock period** and **Start new versioned run**.
- **EIR computation fixed** for SONIA / SOFR / RFR-driven deals (Libra 2/3, Volt) and for multi-tranche / multi-underlying wrappers (Suffolk Solar, Volt Multi-Loan). EIR previously displayed 0% for these; now displays a face-weighted aggregate plus a breakdown ("SONIA 4.7500% + margin 4.5000% = 9.2500%").
- **Stage 1 PortF Excel ingestion** now merges engine-computed rate / interest / fee values into the parser's rows on a per-row basis (the Excel template doesn't carry these columns). Previously skipped entirely if any row had a non-zero value; now fills only the missing-or-zero fields and respects explicit Excel values.
- **Daily-cell sync** — when a PortF Excel maps to a different deal than the dropdown, Run Accounting auto-synces the dropdown, snapshots defaults, and reloads the Treatment panel so the controls reflect the resolved deal.
- **Reset to defaults** now also restores `modificationEvents` and `pik` (not just `ifrs` / `fees`). Snapshot taken on first deal access; dirty-check covers the full set so the "treatment overridden" chip is accurate.
- **Investran chart updated** — `NewReport (4).xlsx` brought in dedicated transaction types per fee category (Arrangement / Commitment / Guarantee / Management / Dividend Equity), default interest income, default fee income, and non-use fee income. Previously 9 gap categories; now only one optional gap remains (`Non-use fee receivable` transtype on the Northwind revolver).

The remainder of the guide is unchanged in structure — the sections below have been updated where relevant.

---

## 1. What this module does

The Loan Module Integration Layer is a thin orchestration layer that sits between four real systems in the NWF consortium:

```
PortF  →  PCS / Investran  →  Workday GL  →  Reconciliation  →  PortF Feedback
(SoR)     (Accounting)        (Postings)     (PCS vs WD)        (Breaks)
```

Each system continues to do what it was built for. The integration layer's job is to:

1. **Accept** the contractual cashflows that PortF has already calculated as the System of Record (SoR).
2. **Apply** IFRS 9 / IFRS 13 / IFRS 15 accounting policy to those cashflows, producing balanced double-entry journals mapped to the Investran chart.
3. **Push** those journals to Workday GL via the FIS Investran Data Import Utility (DIU) batch envelope, with a deterministic external key for idempotent retries.
4. **Receive** the actual cash settlements back from Workday after the period closes.
5. **Reconcile** PCS expected vs Workday actual line by line, flag breaks, and send a structured feedback payload back to PortF for the deal team to investigate.

There is **no duplication of contractual data**. Every output traces back to a versioned PortF deal record, and every accounting decision is auditable.

A separate, pre-existing module — the original `income-calculator.html` Loan Module — remains the single source of truth for the calculation engine. The integration layer reuses that engine via two extracted scripts (`loan-module-engine.js`, `loan-module-instruments.js`) so there is exactly one place where day-count, EIR, ECL, FX, modification, and hedge accounting are implemented.

---

## 2. The 5-stage pipeline at a glance

Each section in the UI is a self-contained card numbered 1–5. A card lights up active (blue) when it's ready for input, and turns done (green) when the previous stage's output has been consumed.

| Stage | Owner | Purpose | UI status chip |
|---|---|---|---|
| 1. PortF Inbound | PortF deal team | Hand contractual setup + cashflows to PCS | "Loaded · N days" |
| 2. PCS / Investran | Accounting team | Classify, compute EIR / ECL / FV, generate JEs | "Ready · N JE rows" |
| 3. Workday GL Outbound | Accounting → GL ops | Wrap JEs into a DIU batch and post | "Posted · batch ID" |
| 4. Workday Cash Inbound | GL ops | Pull actual cash settlements after close | "Loaded · N actuals" |
| 5. Reconciliation + Feedback | Accounting + deal team | Compare, flag breaks, route to PortF | "Reconciled · N breaks" |

Each stage's "Run" button enables only when the previous stage's output exists. This enforces ordering without gating on permissions.

---

## 3. Quick start — your first end-to-end run

Open `loan-module-integration-layer.html` in a browser (no server needed; it's a single HTML file with two co-located JavaScript files).

1. Pick a deal from the **Active Deal** dropdown at the top — start with **Libra 2** (a 7-year £25m bilateral term loan held at amortised cost; the most fully-featured demo deal).
2. Stage 1 → click **Use Active Deal as Sample**. The PortF JSON payload is generated from the deal record and a 2,559-row daily accrual schedule appears.
3. Stage 2 → click **Run Accounting**. Classification, EIR, fair value treatment, KPIs, and 18 IFRS-aligned journal rows render. The Accounting Evidence Pack (six panels) appears below.
4. Stage 3 → click **Push DIU to Workday**. A deterministic external key is computed, the batch is balanced (DR == CR check), and a batch ID is issued.
5. Stage 4 → click **Synthesise Sample (with variances)**. Five cash actuals load; two are deliberately wrong to demonstrate the recon path.
6. Stage 5 → click **Run Reconciliation**. Three lines tie, two break (one timing, one amount). Click **Send Feedback to PortF** to download the JSON payload that would POST to PortF's `/api/integration/feedback` endpoint.

Total elapsed time: under 30 seconds. Refresh and try **Libra 3** (same deal, but with a Cash Flow Hedge layered on) to see hedge-accounting JEs appear.

---

## 4. Stage 1 — PortF Inbound (Deal Setup & Contractual Cashflows)

### 4.1 What PortF owns

PortF is the System of Record. It owns:

- Deal capture, versioning, ratchets, drawdowns, day-count, holiday calendar, default-rate and PIK terms.
- Workflow approvals (deal-team sign-off before sending to PCS).
- Reporting, dashboards, and the PortF UI.

The integration layer does **not** re-implement any of these. It accepts a payload PortF has already built.

### 4.2 The four buttons

| Button | What it does | When you'd use it |
|---|---|---|
| **Load JSON from PortF** | Opens a textarea to paste a PortF cashflow JSON, or upload a `.json` file | Production path — PortF exports JSON via REST/file drop |
| **Load Excel from PortF** | Parses a PortF cashflow Excel workbook with the canonical sheet layout | Operator path — when PortF deal teams hand over an Excel file |
| **Sample Excel** | Downloads a blank Excel template showing the expected sheet structure | Hand to a deal team that's never produced one |
| **Use Active Deal as Sample** | Generates a synthetic PortF JSON from one of the 13 seed instruments | Demo / testing — no external data needed |

### 4.3 Canonical PortF JSON contract

The payload PortF sends has two halves: the deal `instrument` (static contract) and the `accrualSchedule` (daily cashflow rows the engine will post). Excerpt for Libra 2:

```json
{
  "source": "PortF v2026.05",
  "exportedAt": "2026-04-30T16:00:00Z",
  "instrument": {
    "id": "libra2",
    "legalEntity": "NWF Sustainable Infrastructure",
    "leid": 42,
    "deal": "Libra 2",
    "position": "NWF 100% Bilateral Position · Libra 2",
    "incomeSecurity": "HSBC Facility B4 — Libra 2 (Compounded SONIA + 250bps)",
    "currency": "GBP",
    "faceValue": 25000000,
    "commitment": 25000000,
    "settlementDate": "2024-10-08",
    "maturityDate": "2031-10-10",
    "coupon": { "type": "SONIA", "spread": 0.025, "ratchets": [...] },
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
    {
      "date": "2024-10-13",
      "balance": 0,
      "draw": 0,
      "currentRate": 0.09,
      "dailyInterest": 0,
      "dailyFees": 437500,
      "feeBreakdown": { "Arrangement Fee": 437500 }
    },
    ...
  ]
}
```

### 4.4 What you see after loading

The PortF Summary panel populates with:

- **Deal identity**: legal entity, deal name, position, security ID
- **Term**: settlement → maturity, days in window, currency
- **Notional**: face value vs commitment (both shown — they differ for revolvers and guarantees)
- **IFRS context**: classification, SPPI test, business model, ECL stage
- **Schedule preview**: first 8 days of the daily accrual schedule

A green chip "Loaded · 2,559 days · £25,000,000 facility" appears in the status bar. The Stage 2 **Run Accounting** button enables.

**PortF Excel merge behaviour** — the canonical PortF Excel template doesn't carry rate / interest / fee / PIK columns; it only has Date, Initial Purchase, Drawdown, Principal Payment, Day Count, and Amount (Balance). On import, the parser writes those rows and then merges in the engine's daily values (rate, dailyInterest, dailyFees, dailyPik, capitalised) on a per-row basis — only filling missing-or-zero fields, never overwriting any explicit values the Excel does provide. So when PortF starts populating richer columns in future, those values take precedence and the merge becomes a no-op.

**Auto-sync to the resolved deal** — if the Excel maps to a different deal than the active-deal dropdown selection (e.g. you load `Volt - Guarantee` while Libra 2 is selected in the dropdown), Stage 2's Run Accounting auto-syncs the dropdown, snapshots the new deal's defaults for the Reset button, and reloads the Treatment panel so the 24+ controls reflect the resolved deal. You'll see the dropdown flip from "Libra 2" to "Volt" without intervention.

### 4.5 Working example — Libra 2

Click **Use Active Deal as Sample** while Libra 2 is selected. You should see:

- Deal: Libra 2 / NWF Sustainable Infrastructure / NWF 100% Bilateral Position
- Term: 2024-10-08 → 2031-10-10 (2,559 days)
- Currency: GBP, Face = Commitment = £25,000,000
- IFRS 9: AmortisedCost · SPPI passed · HoldToCollect · ECL Stage 1
- Schedule sample shows: Day 1 (2024-10-13) — Arrangement Fee £437,500 booked, no balance yet (drawdown is on day 1 of the deal). Day 2 onwards — daily interest accrual on the £25m balance at SONIA + 250bps.

If you want to test the JSON path, copy that PortF JSON shape, paste it into **Load JSON from PortF**, and click Apply — you should see identical numbers.

---

## 5. Stage 2 — PCS / Investran (the IFRS-aligned Accounting Engine)

This is the largest stage. It contains:

- **Capability grid** — 10 cards summarising what IFRS treatments are exercised for the loaded deal
- **Editable Accounting Treatment panel** — 24 controls letting you override the deal's accounting policy and re-run
- **Change-handling panel** — 5 cards explaining how amendments, restatements, treatment changes, ECL stage migrations, and hedge designations are handled
- **KPIs** — Interest, fees, PIK, EIR accretion, JE count
- **Journal table** — every JE row with DR/CR, Investran account number, GL account name
- **Accounting Evidence Pack** — 6 collapsible panels covering month-end close, carrying-value waterfall, PoP variance, FV sensitivities, ECL templates, and modification + audit history

### 5.1 The IFRS treatments applied (in order)

When you click **Run Accounting**, the engine runs through, in this order:

1. **IFRS 9 §5.1 Classification** — reads `instrument.ifrs.ifrs9Classification`. Possible values: `AmortisedCost`, `FVOCI`, `FVTPL`. If `sppiPassed === false`, the deal is forced to FVTPL regardless of business model.
2. **IFRS 9 §B5.4 Effective Interest Rate (EIR)** — solves for the yield that NPVs all contractual cashflows (drawdowns, repayments, fees-included-in-EIR) to zero. If the deal was drawn at par with no upfront fees rolled in, EIR = coupon rate.
3. **IFRS 13 Fair Value** — if the classification is FVOCI/FVTPL, the engine flags the fair-value level (Level 1 / 2 / 3) and notes whether unobservable inputs trigger sensitivity disclosure.
4. **IFRS 15 Fee Revenue** — splits each fee into over-time vs point-in-time vs EIR-included. Routed to dedicated GL accounts (492100 Arrangement, 492200 Commitment, 492300 Guarantee, 492400 Management, 492500 Dividend Equity).
5. **IFRS 9 §5.5 ECL** — runs on Stage 1 / 2 / 3 inputs (`pdAnnual`, `lgd`, `ecLStage`). Books impairment expense to 470000 and the contra-asset allowance to 145000. Migration between stages is handled by the change-handling panel.
6. **IFRS 9 §5.4.3 Modification accounting** — on any deal modification event in the schedule, the engine recomputes the present value at the original EIR, calculates the gain or loss, and (if the change is "substantial") re-derives EIR going forward.
7. **IFRS 9 §6 Hedge Accounting** — only kicks in if the deal has a `hedge` block. Splits MTM into effective (CFH OCI reserve, account 360000) and ineffective (P&L, account 451000) portions; FV hedge MTM goes through 452000.

### 5.2 Capability grid — what to expect for each deal

| Deal | Classification | EIR | ECL | Modification | Hedge |
|---|---|---|---|---|---|
| Alliance Manufacturing | AmortisedCost | 12% / 14% PIK | Stage 1 | — | — |
| Copperleaf Capital | AmortisedCost | EIR > coupon (issued at discount) | Stage 1 | — | — |
| Orion Industrial | AmortisedCost | SOFR + 575bps | Stage 1 | — | — |
| Northwind RCF | AmortisedCost | SONIA + non-use fee | Stage 1 | — | — |
| Meridian Unitranche | AmortisedCost | SOFR + 600bps | Stage 1 | — | — |
| Libra 2 | AmortisedCost | SONIA + 250bps | Stage 1 | — | — |
| **Libra 3** | AmortisedCost | SONIA + 250bps | Stage 1 | — | **Cash Flow Hedge** |
| Volt | AmortisedCost (guarantee) | Guarantee fee EIR | Stage 1 | — | — |
| XYZ Buyout Fund | **FVTPL** | LP commitment | n/a | — | — |
| ABCDEF Series C | **FVTPL** | Equity dividends | n/a | — | — |
| Suffolk Solar Phase 2 | AmortisedCost | Multi-tranche blended EIR | Stage 1 | — | — |
| Volt Multi-Loan | AmortisedCost (guarantee) | Multi-underlying | Stage 1 | — | — |

### 5.3 The editable Accounting Treatment panel

The panel groups controls into seven sections covering both accounting policy and contractual overrides. Every control change auto-triggers an engine re-run if PortF data is loaded — the journals, KPIs, Daily Schedule, capability cards, and Evidence Pack panels all refresh in place. The "Reset to defaults" button reverts every control plus any injected modification events plus PIK overrides back to the deal's original record.

#### A. Core Classification
- IFRS 9 Classification (AmortisedCost / FVOCI / FVTPL)
- SPPI test (passes / fails — fails forces FVTPL)
- Business model (HoldToCollect / HoldToCollectAndSell / Other)
- **Fair Value Level (1 / 2 / 3)** — applies to both balance-sheet FV (FVTPL/FVOCI per IFRS 13 §72) and disclosure-only FV on amortised-cost holdings (per IFRS 7 §25). The FV display in Stage 2 and the FV capability card both honour the chosen Level
- ECL Stage (1 / 2 / 3 / POCI)

#### B. Credit Risk & ECL Detail (IFRS 9 §5.5)
- POCI flag (purchased or originated credit-impaired)
- Stage 3 interest base (Gross / Net of allowance)
- Suspended interest (true / false)
- EAD CCF (credit conversion factor for undrawn commitments)
- DPD thresholds for Stage 2 / Stage 3 migration
- Watchlist override
- Macroeconomic overlay weight
- Annual PD / LGD

#### C. Modification Policy (IFRS 9 §5.4.3)
- Substantial threshold (default 10% NPV change)
- Re-compute EIR on substantial modification (true / false)
- Default treatment (Auto / Always-Substantial / Always-Non-Substantial)
- Continuing involvement (for partial derecognition)

#### C-bis. Modification Events (inline editor) — NEW

Below the policy controls is an event-list editor. The deal's existing modification events appear as table rows; every cell is inline editable:

| Cell | Editor type | Effect |
|---|---|---|
| Date | `<input type="date">` bounded by settle → maturity | Engine pinpoints the modification day |
| Type | Dropdown | Substantial = derecognise + re-EIR; non-substantial = adjust carrying value, post P&L |
| Gain / (Loss) | Number with currency prefix | Posts to 442000 Modification G/L (CR if positive, DR if negative) |
| Reason | Free text | Carries through to JE comments + PortF feedback payload |

Three action buttons:
- **+ Non-substantial mod** injects a sample event at 1/3 of deal life with a £10k gain and reason "Covenant amendment — leverage step-up"
- **+ Substantial mod** injects a derecognition loss equal to −1.25% of notional with the spread bumped +75bps from the modification date forward (changes EIR going forward)
- **Clear** removes all events

When the editor is non-empty the "Modifications: gain/loss, new EIR, derecognition" capability card lights green; the Modification History panel in the Evidence Pack logs the run as treatment-dirty.

#### C-tris. PIK Interest (contractual override) — NEW

Three controls under the modification editor let you override the deal's PIK terms inline:
- **PIK enabled** — Yes / No
- **PIK rate (annual)** — decimal (e.g. `0.03` = 3%)
- **Capitalisation frequency** — Monthly / Quarterly / Semi-annual / Annual

Strictly this is contractual data (it lives on `instrument.pik`, not in the IFRS block), but the inline editor is convenient for testing scenarios. A live chip next to the heading shows the current state ("disabled" or "enabled · 3.00% · Quarterly"). When enabled, the engine accrues daily PIK on the drawn balance and posts capitalisation events to **141000 Investments at Cost** as `Investment accretion - PIK interest` on each period boundary. The KPIs strip's "Total PIK (life)" updates immediately.

#### D. Tax & Other Policy
- Withholding tax rate
- WHT recoverability (Recoverable / Not recoverable)
- Deferred tax tracking (true / false)
- FX revaluation cadence (Daily / Period-end / On-event)

#### E. Per-fee IFRS 15 treatment
For each fee in the deal, choose over-time / point-in-time / EIR-included. The engine re-routes each fee's recognition pattern accordingly.

#### Behaviour after a change

Every control change auto-runs the engine when PortF data is loaded:
1. `M.schedule = buildSchedule(inst)` rebuilds the daily grid with the new policy
2. `M.summary = summarize(...)` aggregates the period totals
3. `M.acctJournals = generateDIU(...)` regenerates the JE rows
4. The Daily Schedule view, KPIs, capability grid, journal table, and Evidence Pack all re-render
5. Stage 3-5 are invalidated (Workday batch cleared, recon cleared) because the journals changed
6. The Modification History audit-trail entry for the new run is flagged "override" if the controls differ from the deal defaults

### 5.4 The 18 journal rows for Libra 2

Running accounting on Libra 2 produces 18 journal rows (period-end summarisation across the 7-year window):

| # | Effective Date | Transaction Type | Account | DR/CR | Amount |
|---|---|---|---|---|---|
| 1 | 2024-10-08 | Loan Drawdown | 141000 | DR | £25,000,000 |
| 2 | 2024-10-08 | Loan Drawdown — Cash | 111000 | CR | £25,000,000 |
| 3 | 2031-10-10 | Income - Daily Accrued Interest | 421000 | CR | £13,361,596 |
| 4 | 2031-10-10 | Interest Receivable | 113000 | DR | £13,361,596 |
| 5 | 2031-10-10 | Interest Cash Receipt | 111000 | DR | £13,361,596 |
| 6 | 2031-10-10 | Interest Receivable Clear | 113000 | CR | £13,361,596 |
| 7 | 2024-10-08 | Arrangement Fee Receivable | 113000 | DR | £437,500 |
| 8 | 2024-10-08 | Arrangement Fee Income (IFRS 15) | 492100 | CR | £437,500 |
| 9 | 2024-10-08 | Arrangement Fee Cash Receipt | 111000 | DR | £437,500 |
| 10 | 2024-10-08 | Arrangement Fee Receivable Clear | 113000 | CR | £437,500 |
| 11 | 2031-10-10 | Commitment Fee Receivable | 113000 | DR | £568,401 |
| 12 | 2031-10-10 | Commitment Fee Income (IFRS 15) | 492200 | CR | £568,401 |
| 13 | 2031-10-10 | Commitment Fee Cash Receipt | 111000 | DR | £568,401 |
| 14 | 2031-10-10 | Commitment Fee Receivable Clear | 113000 | CR | £568,401 |
| 15 | 2031-10-10 | Loan Drawdown | 141000 | DR | £0 |
| 16 | 2031-10-10 | Loan Drawdown — Cash | 111000 | CR | £0 |
| 17 | 2031-10-10 | Impairment Expense (ECL) | 470000 | DR | £42,500 |
| 18 | 2031-10-10 | Loan Loss Allowance (Contra-Asset) | 145000 | CR | £42,500 |

Total DR = Total CR = £39.41m. The balance check passes; the green "balanced" chip lights up.

### 5.4-bis Daily Schedule view — NEW

Between the journal table and the Evidence Pack is a collapsible "Daily Schedule" panel that surfaces the engine's per-day output. It re-renders on every Run Accounting (i.e. on every treatment change) so it always reflects current state.

**Header strip:**
- A row-count chip — e.g. "631 of 2,559 rows · showing first 500"
- A filter dropdown:
  - **Material events only** (default) — drawdowns, repayments, capitalisations, fees, PIK, ECL movements, modification events
  - **All days** — every day from settlement → maturity
  - **Month-end days only** — useful for monthly accrual review
- **Download Full CSV** — exports all 47 engine columns
- **JSON** — exports `{deal, runMeta, summary, schedule}` envelope

**Preview table** (max 500 rows) shows 17 columns: Date · Balance · Drawn · Draw · Repay · Rate · Daily Interest · Daily PIK · PIK Capit. · Daily Fees · EIR Accret. · Carrying · ECL Alw. · ECL Δ · Mod G/L · FX · Hedge P&L. Material event rows highlight in blue; zero values render as `—` for readability.

**The 47-column CSV export** contains every field the engine produces:

```
date, balance, drawnBalance, carryingValue, draw, paydown,
couponRate, floatingRate, currentRate,
dailyCash, cumInterestAccrued, cumInterestEarned,
capitalized, interestAdjustments, cashInterestPayment,
pikRate, dailyPik, cumPikAccrued, cumPikEarned, pikInterestAdjustments, pikPaydown,
amortDaily, cumAmort,
nonUseFee, cumNonUseFee,
dailyFees,
dailyEIRAccretion, cumEIRAccretion,
dailyDefaultInterest, dailyDefaultFee, cumDefaultInterest, cumDefaultFee,
dailyECLChange, eclAllowance, cumECLChange,
dailyModGain, modEventDescription, cumModGain,
fxRate, dailyFXGain, cumFXGain, balanceFC,
dailyHedgeOCI, dailyHedgePL, dailyHedgeReclass,
cashFlowHedgeReserve, cumHedgeOCI, cumHedgePL, cumHedgeReclass, hedgeEffectiveness,
hasEvent
```

The CSV uses the same sanitiser pipeline as the DIU CSV (en-dash → hyphen, section symbol stripped, currency symbol → 3-letter code, money fields rounded to 2 dp, UTF-8 BOM prepended), so it opens cleanly in Excel.

### 5.5 The 6 Accounting Evidence Pack panels

Below the journal table, six collapsible panels cover the NWF accounting agenda end-to-end:

#### A. Month-End Close + Run Metadata
A run identifier (e.g. `PCS-20260508-LIBRA2-9b3f2a1c`), version number, effective date, run timestamp, user, current period dates, and a status workflow chip: **Draft → Reviewed → Approved → Posted**. The four-step gate enforces sequential progression — the Reviewer button is enabled only at Draft, Approve only at Reviewed, Post only at Approved. In production each step requires a different user (segregation of duties), and Stage 3 push to Workday would gate on Reviewed + Approved.

When the period reaches **Posted**, the panel switches into a locked-period view: all four chips turn green with check icons, the action buttons are replaced with **Unlock period** (reverts to Approved) and **Start new versioned run**, and a green "Period Locked — Posted to GL" banner appears. Re-runs always remain available — they create a new versioned Draft entry in the audit history.

A coloured chip flags whether the run used the deal's default policy or an override (any change to the IFRS block, fee treatments, PIK, or modification events triggers the override flag).

#### B. Carrying Value Waterfall (IAS 1 §54) — corrected anchor

The waterfall anchors on **opening carrying value** (not opening principal balance). For deals with upfront IFRS 15 EIR-included fees, day-1 carrying value is *negative* — the fee is held as a contra to the asset and accreted into income over life via `dailyEIRAccretion`. The waterfall now itemises this via a "Deferred fees at recognition" line.

For Libra 2 (drawn at par, no upfront EIR fee):

```
Opening principal balance              £0
− Deferred fees at recognition (IFRS 9 EIR)   £0
= Opening carrying value (gross)       £0
+ Drawdowns                            £25,000,000
− Repayments                           (£25,000,000)
+ EIR Accretion (IFRS 9 §B5.4)         £0  (drawn at par)
+ Discount / OID amortisation          £0
+ PIK Capitalised                      £0
+ Modification gain / loss             £0
+ Hedge P&L                            £0
+ FX Revaluation                       £0
= Closing carrying value (gross)       £0

Memo — ECL Allowance Disclosure (IFRS 9 §5.5)
  Closing carrying value (gross): £0
  Less: ECL allowance:            (£42,500)
  Net carrying value:             (£42,500)
```

For Volt (£1.92m of upfront arrangement fee deferred at signing):

```
Opening principal balance              £0
− Deferred fees at recognition (IFRS 9 EIR)   (£1,919,562)
= Opening carrying value (gross)       (£1,919,562)
+ Drawdowns                            £800,000,000
− Repayments                           (£755,555,555)
+ EIR Accretion (IFRS 9 §B5.4)         £1,920,438
= Closing carrying value (gross)       £44,444,883
```

**ECL is now a memo block, not a movement** — under IFRS 9 §5.5 the allowance is presented as a separate contra-asset, so the waterfall ties to gross carrying. The memo block shows gross → less ECL → net for the disclosure note.

A tie-out chip is green when the waterfall sums to closing carrying value within £1; amber when there's a rounding residual (typical on multi-thousand-day daily schedules — under £500 on Volt's 4,383 days is acceptable).

#### C. Period-on-Period Variance Walk (PoP)
Decomposes ΔInterest between two halves of the schedule into Rate × Balance × Days × Modification × Cross/mix residual. Useful when leadership asks "why did interest income jump £400k between Q3 and Q4?" — the panel attributes the change to specific drivers.

For Libra 2, the panel splits the schedule mid-life and computes:
- Rate effect ≈ (rate_B − rate_A) × bal_A × days_A / 365
- Balance effect ≈ rate_A × (bal_B − bal_A) × days_A / 365
- Day-count effect ≈ rate_A × bal_A × (days_B − days_A) / 365
- Modification effect ≈ Σ daily mod gain in B − Σ in A
- Residual = total ΔInterest minus the sum of the named effects

#### C. Period-on-Period Variance Walk (PoP)
Decomposes ΔInterest between two halves of the schedule into Rate × Balance × Days × Modification × Cross/mix residual. Useful when leadership asks "why did interest income jump £400k between Q3 and Q4?" — the panel attributes the change to specific drivers.

For Libra 2, the panel splits the schedule mid-life and computes:
- Rate effect ≈ (rate_B − rate_A) × bal_A × days_A / 365
- Balance effect ≈ rate_A × (bal_B − bal_A) × days_A / 365
- Day-count effect ≈ rate_A × bal_A × (days_B − days_A) / 365
- Modification effect ≈ Σ daily mod gain in B − Σ in A
- Residual = total ΔInterest minus the sum of the named effects

#### D. Fair Value Sensitivities (IFRS 13 §93) — branches by Level

The sensitivity set displayed depends on the FV Level chosen in the Treatment panel. If no Level is set, an amber alert prompts you to set one (with the right citation: IFRS 13 §72 if on balance sheet, IFRS 7 §25 for amortised-cost disclosure).

| Level | Sensitivities shown | Inputs disclosure |
|---|---|---|
| **Level 1** — quoted price | ±10% / ±25% market price shocks (no rate/spread sensitivity needed; price is observable) | Quoted price source · bid-ask spread · market depth |
| **Level 2** — observable inputs | ±50 / ±100 bps parallel rate shifts + ±50 bps credit spread | Reference yield curve · credit spread (peer basket) · FX rate |
| **Level 3** — unobservable inputs | ±150 bps stress rate shifts, ±100 bps spread, ±200 bps illiquidity premium, ±5% recovery rate | **Significant unobservable inputs (IFRS 13 §93(d))** — discount rate, PD (live from instrument), LGD (live), illiquidity premium, cashflow volatility |

Methodology — linear modified-duration approximation: ΔFV ≈ −Modified Duration × Δyield × Carrying. Modified Duration ≈ life × 0.6 as a heuristic for bullet-style loans. For Level 3, the placeholder still computes magnitude correctly; in production you'd swap in a full DCF + Monte Carlo using the unobservable inputs surfaced in the disclosure table.

For amortised-cost deals (most NWF positions) the panel still shows the disclosure-only sensitivity because IFRS 7 §25 requires it in the notes — the same Level you pick drives both balance-sheet measurement (where applicable) and the disclosure note.

#### E. IFRS 9 ECL Journal Templates
Six template entries showing the canonical DR/CR pattern for:
- Initial recognition — Stage 1 (12-month ECL): DR 470000 / CR 145000
- Stage 1 → Stage 2 transition (significant increase in credit risk): DR 470000 / CR 145000 (lifetime build)
- Stage 2 → Stage 3 (credit-impaired): DR 470000 / CR 145000 (Stage 3)
- Stage 3 → Stage 2 cure (release): DR 145000 / CR 470000
- Default / write-off: DR 145000 / CR 160000 (loan written off)
- Post-write-off recovery: DR 111000 / CR 470100

These are templates with illustrative amounts (£100, £400, etc.); the engine substitutes the period's own ECL movement when posting.

#### F. Modification History + Audit Run History
- **Before / after EIR table** showing coupon vs effective yield, P&L impact, and the substantial-modification threshold from the policy panel
- **Modification events** found in the schedule (date, description, gain/loss)
- **Run history** — last 10 accounting runs across all deals, with run ID, version, when, user, status (Draft/Reviewed/Approved/Posted), JE row count, and treatment-policy flag (default vs override)

The current run is highlighted in light blue. Each click of **Run Accounting** appends a new versioned row.

### 5.6 Re-running with a treatment override (worked example)

Scenario: leadership wants to model what would happen if Libra 2 were reclassified from AmortisedCost to FVTPL.

1. In the editable treatment panel, change **IFRS 9 Classification** to FVTPL.
2. The capability grid amber-highlights the cards affected (Recognition, EIR, Fair Value, ECL).
3. Click **Re-run with current treatment**.
4. New run ID `PCS-20260508-LIBRA2-...` appears in Modification History flagged "override".
5. Stage 3 push button re-enables. The Workday batch from the previous run is invalidated (cleared to nothing) and so is the reconciliation.

This is intentional cascade behaviour: changing policy in Stage 2 invalidates downstream Stages 3–5 because they were built off a different journal set.

---

## 6. Stage 3 — Workday GL Outbound (DIU Batch Push)

### 6.1 What gets sent

The integration layer wraps the journals into the canonical FIS Investran DIU envelope and posts to Workday's GL via the DIU `/batches` endpoint. The envelope carries:

| Field | Example |
|---|---|
| `templateId` | `b1e8d7c4-3f5a-4c62-8d9e-7a6b5c4d3e2f` (GL_JOURNAL_V1) |
| `templateName` | `GL_JOURNAL_V1` |
| `externalKey` | `lmil-libra2-2024-10-08-to-2031-10-10-9b3f2a1c` |
| `batchId` | `WD-20260507-LIBRA2-4729` |
| `batchType` | `STANDARD` |
| `batchComments` | `LMIL · Libra 2 · NWF 100% Bilateral · 2024-10-08-to-2031-10-10` |
| `generatedAt` | `2026-05-07T16:00:42Z` |
| `sourceModule` | `Loan Module Integration Layer` |

### 6.2 The deterministic externalKey

The external key is built from `lmil-{instrumentId}-{period}-{rowsHash}`. The rows hash is a djb2 over `effectiveDate|transactionType|amountLE|account` for every row, so two identical batches produce the same key. Workday treats matching external keys as idempotent — re-posting the same batch is a no-op rather than a duplicate. This makes retries safe.

### 6.3 The balance check

Before issuing a batch ID, the layer sums DR vs CR across all rows. If they balance to within £0.01 the batch is accepted; otherwise the chip turns red ("UNBALANCED") and the batch is rejected. This is a defence-in-depth check — the engine generates balanced JEs by construction, so an unbalanced batch indicates a corruption that should never reach Workday.

### 6.4 Two output formats

- **Push DIU to Workday** (production path) — POSTs the batch envelope as JSON. In this UI demo, it shows the resulting envelope on screen and stamps Stage 3 done.
- **Download CSV** (operator path) — dumps a 24-column CSV matching the Investran DIU spreadsheet template (`legalEntity`, `leid`, `batchId`, `jeIndex`, `txIndex`, `glDate`, `effectiveDate`, `deal`, `position`, `incomeSecurity`, `transactionType`, `account`, `allocationRule`, `batchType`, `batchComments`, `transactionComments`, `originalAmount`, `amountLE`, `fx`, `amountLocal`, `isDebit`, `leDomain`, `glAccountName`, `glTransType`).

You can also click **DIU Template (blank)** in Stage 2 to download an empty 24-column DIU template for any other use.

**CSV sanitisation** (applies to both DIU CSVs and the Daily Schedule CSV)
- Typographic Unicode is replaced with portable ASCII so legacy Excel and downstream ETL tools read the file cleanly: en-dash `–` / em-dash `—` → `-`, middle-dot `·` → `-`, section symbol `§` → stripped, curly quotes → straight, ellipsis `…` → `...`, non-breaking spaces → spaces.
- Currency symbols are swapped for 3-letter codes — `£` → `GBP `, `€` → `EUR `, `¥` → `JPY `.
- Money fields (`amountLE`, `amountLocal`, `originalAmount`) are rounded to 2 decimal places. The `fx` ratio keeps full precision.
- A UTF-8 BOM is prepended so Windows Excel opens the file with the correct encoding by default.

### 6.5 Working example — Libra 2

After Run Accounting in Stage 2 succeeds, click **Push DIU to Workday**. You should see:

- Batch ID: `WD-20260508-LIBRA2-XXXX` (random suffix)
- External key: `lmil-libra2-2024-10-08-to-2031-10-10-XXXXXXXX`
- Rows: 18
- Balance: £39,407,901 / £39,407,901 — green "balanced" chip

Stage 4 button enables.

---

## 7. Stage 4 — Workday Cash Inbound (Actuals)

### 7.1 What Workday returns

After the period closes, Workday returns the actual cash settlements that posted against each batch. The shape:

```json
{
  "source": "Workday Financial Management",
  "batchId": "WD-20260507-LIBRA2-4729",
  "periodStart": "2024-10-08",
  "periodEnd": "2031-10-10",
  "actuals": [
    {
      "date": "2024-10-13",
      "transactionType": "Arrangement Fee Cash Receipt",
      "account": "111000",
      "amountLE": 437500.00,
      "isDebit": true,
      "workdayJournalId": "WD-JE-10001",
      "status": "POSTED"
    },
    ...
  ]
}
```

Status can be `POSTED`, `CANCELLED`, or `FAILED`. CANCELLED and FAILED rows are flagged as breaks regardless of amount.

### 7.2 Two ways to load

| Button | What it does |
|---|---|
| **Load Actual Cash from Workday** | Paste / upload a real Workday actuals JSON |
| **Synthesise Sample (with variances)** | For demo: builds actuals from PCS journals with deliberate breaks (1 timing variance, 1 amount variance) |

### 7.3 Working example — Libra 2 with deliberate breaks

Click **Synthesise Sample (with variances)** for Libra 2. The engine takes the 5 cash-leg lines (account 111000) and:

- Keeps 3 lines exactly correct
- Shifts one line by +1 day (timing variance)
- Modifies one line by −£500 (amount variance)
- Optionally drops one line (missing variance) — for revolvers with multiple drawdowns

The actuals table renders with a status chip per row: green "POSTED" or red "CANCELLED". Stage 5 button enables.

---

## 8. Stage 5 — Reconciliation + PortF Feedback

### 8.1 Reconciliation logic

For each PCS expected cash line, the layer searches for a matching Workday actual on the same effective date and transaction type. The match falls into one of three buckets:

| Bucket | Criterion | Action |
|---|---|---|
| **tied** | Δ within absolute tolerance (£1) | Pass |
| **within** | Δ within break threshold (0.5% by default) | Pass with note |
| **break** | Δ > 0.5% OR row is missing OR status is CANCELLED/FAILED | Flag for investigation |

Tolerances are configurable in the engine's `RECON_TOLERANCES` constant.

### 8.2 The PortF Feedback payload

When you click **Send Feedback to PortF**, the layer downloads a structured JSON ready to POST to PortF's `/api/integration/feedback` endpoint:

```json
{
  "api": "PortF Integration Feedback v1",
  "endpoint": "POST /api/integration/feedback",
  "feedbackType": "RECONCILIATION_BREAKS",
  "generatedAt": "2026-05-07T16:00:00Z",
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
    "cashLinesCompared": 5,
    "tied": 3,
    "withinTolerance": 0,
    "breaks": 2,
    "tieRatePct": 60.00,
    "netVarianceLE": -500.00,
    "totalAbsoluteVarianceLE": 437500.50
  },
  "breaks": [
    {
      "date": "2025-01-10",
      "transactionType": "Commitment Fee Cash Receipt",
      "account": "111000",
      "pcsExpected": 88219.18,
      "workdayActual": 87719.18,
      "varianceLE": -500.00,
      "variancePct": 0.5667,
      "reason": "Variance 0.57% > 0.5% threshold",
      "workdayJournalId": "WD-JE-10002",
      "action": "INVESTIGATE — confirm cashflow with PortF deal team"
    }
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

The deal team in PortF receives this as a task. They investigate, decide:

- **Cashflow was wrong** → amend the deal in PortF, push a new version, re-run Stages 1 → 5.
- **Cashflow was right** → raise a Workday GL ticket; the GL team investigates the posting.
- **Tolerance was wrong** → escalate to the policy team to update the tolerance config.

### 8.3 Clean reconciliation path

If all PCS expected lines tie within tolerance, the feedback payload's `feedbackType` flips to `RECONCILIATION_CLEAN` and the period is marked `RECONCILED`. The chip at the top of Stage 5 turns green: "Reconciled · 0 breaks".

---

## 9. Working example — full end-to-end (Libra 2)

### Step 1 — PortF Inbound
Pick **Libra 2** → **Use Active Deal as Sample**.
Result: 2,559-day schedule, £25m face, SONIA + 250bps, IFRS 9 AmortisedCost / Stage 1.

### Step 2 — PCS Accounting
**Run Accounting**.
Result: 18 JE rows, total interest £13.36m, total fees £1.01m, ECL allowance £42.5k. Run ID `PCS-20260508-LIBRA2-XXXXXXXX`.

### Step 3 — Workday Push
**Push DIU to Workday**.
Result: Batch ID `WD-20260508-LIBRA2-XXXX`, external key `lmil-libra2-...`, balance £39.41m DR / £39.41m CR — balanced.

### Step 4 — Workday Cash Actuals
**Synthesise Sample (with variances)**.
Result: 5 cash lines, 3 correct, 1 +1-day timing break, 1 −£500 amount break.

### Step 5 — Reconciliation
**Run Reconciliation**.
Result: 3 tied · 0 within · 2 breaks · tie rate 60% · net variance −£500 · total absolute variance £437,500.50 (the timing break shows up as 100% variance for that single line because the date moved).

**Send Feedback to PortF** → downloads `portf-feedback-libra2-2026-05-08.json`. The deal team in PortF picks it up, decides to keep the +1-day actual (it was a real bank-holiday slip) and amends the cashflow date. New PortF version → re-run Stages 1 → 5 → recon comes back clean.

---

## 10. Treatment override scenarios (case studies)

### 10.1 SICR-driven Stage 2 migration

Scenario: an external rating downgrade triggers Stage 2 migration on Libra 2 mid-life.

1. In the treatment panel, change **ECL Stage** from 1 to 2.
2. The PD increases (lifetime PD vs 12-month) so ECL allowance jumps from £42.5k to ~£185k.
3. Re-run Accounting. New JEs:
   - DR 470000 Impairment Expense £142.5k
   - CR 145000 Loan Loss Allowance £142.5k (the incremental build)
4. The Modification History panel logs the new run flagged "override". The Stage 1 → Stage 2 ECL transition entry from the ECL Templates panel matches what's posted.

### 10.2 SPPI failure → forced FVTPL

Scenario: a covenant amendment in a deal makes the cashflows fail SPPI.

1. Set **SPPI test** to "fails".
2. The capability grid amber-flags Recognition (now FVTPL) and Fair Value (Level 2/3 disclosure required).
3. Re-run. The journal mix changes:
   - The original DR 141000 Loan asset / CR 111000 Cash entry stays
   - But all subsequent EIR-accretion entries flip to FV-driven entries
   - 142000 (Investments at Fair Market Value) becomes the carrying account
   - 450000 Unrealized Gain/Loss receives the MTM movement

### 10.3 Substantial modification under IFRS 9 §5.4.3

Scenario: Libra 2 is amended mid-life — the spread changes from +250bps to +325bps.

1. PortF detects the modification and emits a `modEventDescription` row in the schedule.
2. The engine recomputes NPV at the original EIR. If the change exceeds the 10% substantial-threshold (configurable), it derecognises the old asset and recognises a new one — booking a modification gain/loss to 442000.
3. EIR is re-derived from the modification date forward.
4. The Modification History panel shows EIR before vs after side by side.

---

## 11. Investran GL coverage (the chart of accounts)

Every transaction type the engine emits maps to a real Investran GL account. The complete chart is preserved in `investran-gl-chart-NewReport4.md`.

**Coverage status (2026-05-08, after `NewReport (4).xlsx` update):**

- 13 instruments × ~17 JE rows average = **220 JE rows produced across the seed dataset**
- 218 mapped cleanly · 0 unmapped · 2 gap entries (both `Non-Use Fee Receivable` on the Northwind revolver)
- The only optional ask remaining is to add a single transaction type `Non-use fee receivable` under 113000 — this would get to 100% green coverage

The Stage 2 GL coverage chip below the journal table summarises this for the loaded deal — green when 100% clean, amber when one or more transaction types fall back to a placeholder.

---

## 12. Frequently asked questions

**Q: What happens if PortF sends a deal with a different version mid-period?**
A: The integration layer treats every run as point-in-time. If a new PortF version arrives, the operator is expected to re-run Stages 1 → 5; the externalKey will change because the rows hash changes, and Workday will treat it as a new batch (the old one is left posted unless the operator explicitly reverses it).

**Q: Is the engine deterministic?**
A: Yes. Given identical PortF input and identical treatment-panel settings, the engine produces byte-identical JE rows and an identical externalKey. This is what makes idempotent retries possible.

**Q: What if I want to push the same JEs to a different GL system (not Workday)?**
A: The DIU envelope is a generic ERP-batch shape. Replace the DIU CSV download path with a different posting mechanism; the journal data is the same. The mapping in `INVESTRAN_GL` would need to be re-pointed at the target chart.

**Q: Can I use this in production?**
A: The UI is a working reference implementation. To productionise, replace the in-browser Stage 3 push with a real REST call to FIS Investran's DIU endpoint, the Stage 4 inbound with a Workday API poll, and the Stage 5 feedback with a real POST to PortF's endpoint. The logic is unchanged; only the I/O wrappers differ.

**Q: How are user permissions handled?**
A: The Month-End Close panel in Stage 2 has a Draft → Reviewed → Approved → Posted workflow that demonstrates segregation of duties. In production, each step would be gated on a separate user with a different role.

**Q: How do I add a new accounting policy?**
A: Add a new control to the editable treatment panel HTML, wire it into `applyTreatmentFromForm()` to write to `inst.ifrs.<newField>`, and update `loan-module-engine.js` so the engine reads `<newField>` in the relevant treatment block. The capability grid card in Stage 2 should be updated to surface whether the new policy is active for the loaded deal.

**Q: Why does the carrying value waterfall sometimes show an amber Δ?**
A: The waterfall sums opening carrying + drawdowns − repayments + EIR + OID amort + PIK + modification + hedge P&L + FX. ECL is presented as a memo (contra-asset disclosure), not a movement. The amber chip appears when the calculated total differs from `closingCarrying` by more than £1 — typical residual on multi-thousand-day schedules is sub-£500 from accumulated rounding. Larger residuals signal either (i) a missing movement category not itemised, (ii) a bug in the engine, or (iii) a modification event that the engine logged but the waterfall hasn't yet matched.

**Q: Total Interest (life) is £0 on Volt — is that wrong?**
A: No, that's correct. Volt is a financial guarantee — NWF is the guarantor, not the lender. The borrower pays loan interest to Bank of America (the underlying lender), not to NWF. NWF's only income from this deal is the **guarantee fee** (£26.48m over the deal life), recognised over time under IFRS 15 and posted to 492300. A guarantee is a contingent obligation, not a financial asset that earns coupon interest, so "Total Interest (life) = £0" is the correct accounting answer for any guarantee instrument (Volt, Volt Multi-Loan).

**Q: I changed PIK / a treatment field but the JEs and KPIs didn't update.**
A: This was a bug in earlier revisions. As of this revision, every Run Accounting click — and every auto-rerun triggered by changing a Treatment-panel control — rebuilds `M.schedule` and `M.summary` from the current instrument state at the top of the function, before generating journals. Make sure you've refreshed the page since the fix shipped. If you're still seeing stale numbers, check the browser console for errors — and confirm you've loaded PortF data in Stage 1 (the **Run Accounting** button should be enabled with a "Loaded · N days" chip in Stage 1).

**Q: Why is the EIR showing 9.25% on Libra 2 when the spread is 0% in the deal record?**
A: For SONIA / SOFR / RFR-driven deals, the spread isn't on `coupon.spread` — it's in `marginSchedule[].marginBps`. The base rate is in `rfr.baseRate`. The new `computeEIR` reads both: `rfr.baseRate (4.75%) + margin from marginSchedule (4.50%) = 9.25%`. The breakdown appears in the EIR note line. For multi-tranche deals (Suffolk Solar) and multi-underlying guarantees (Volt Multi-Loan), the function recurses into the children and returns a face-weighted aggregate.

---

## 13. File inventory

| File | Role |
|---|---|
| `loan-module-integration-layer.html` | The integration layer UI (this guide's subject) |
| `loan-module-engine.js` | Shared engine — `buildSchedule`, `summarize`, `generateDIU`, `INVESTRAN_GL`, `applyInvestranGLMapping`, `computeEIR` (with RFR + multi-tranche aggregation) |
| `loan-module-instruments.js` | 13 seed instruments shared with the original Loan Module |
| `income-calculator.html` | Original Loan Module — preserved as the full-featured calculator |
| `INTEGRATION-LAYER-README.md` | Concise architecture overview (the architect's view) |
| `LOAN-MODULE-INTEGRATION-LAYER-GUIDE.md` | This user guide (the operator's view) |
| `gl-account-gaps.md` | Investran GL gap inventory + closure status (post-NewReport(4)) |
| `investran-gl-chart-NewReport4.md` | Readable snapshot of the current Investran chart (67 GL accounts, 266 active transtypes) |
| `legal-entities-deals-securities.xlsx` | Master register of LEs, deals, positions, securities |
| `portf-cashflow-sample.xlsx` | Sample PortF Excel format (downloadable from Stage 1) |
| `USER-GUIDE-2026-05-07.md` | Original Loan Module user guide |
| Generated downloads | `investran-diu-template-blank.csv`, `investran-diu-{deal-id}-{date}.csv`, `workday-diu-{deal-id}-{date}.csv`, `schedule-{deal-id}-{date}.csv`, `schedule-{deal-id}-{date}.json`, `portf-feedback-{deal-id}-{date}.json` (all sanitised + UTF-8 BOM) |

---

## 14. Glossary

| Term | Definition |
|---|---|
| **PortF** | The deal-management System of Record. Owns deal capture, cashflows, ratchets, drawdowns, workflows. |
| **PCS / Investran** | Accounting engine. Translates PortF cashflows into IFRS-aligned journals against the Investran chart. |
| **Workday** | The General Ledger. Receives DIU batches from PCS, posts them to GL, returns actual cash settlements. |
| **DIU** | Data Import Utility — FIS Investran's batch-import API for posting to Workday. |
| **externalKey** | A deterministic hash that lets Workday treat re-posts of identical batches as idempotent. |
| **EIR** | Effective Interest Rate. The yield that NPVs all contractual cashflows to zero. |
| **ECL** | Expected Credit Loss. IFRS 9 impairment provision; Stages 1 (12-month) / 2 (lifetime) / 3 (credit-impaired). |
| **SICR** | Significant Increase in Credit Risk. Triggers Stage 1 → Stage 2 migration. |
| **POCI** | Purchased or Originated Credit-Impaired. Special IFRS 9 category with EIR computed on initial fair value. |
| **CFH / FVH** | Cash Flow Hedge / Fair Value Hedge. IFRS 9 §6 designations. |
| **OCI** | Other Comprehensive Income. The equity reserve where CFH effective gains/losses sit. |
| **CCF** | Credit Conversion Factor. Used to derive EAD on undrawn commitments. |
| **DPD** | Days Past Due. Used for Stage 2 / 3 migration thresholds. |
| **SPPI** | Solely Payments of Principal and Interest. The IFRS 9 §4.1.2 cashflow test. |
| **NWF** | National Wealth Fund. The user organisation. |
| **NWFE** | NWF Renewable Equity (one of the LEs in the seed dataset). |
| **RFR** | Risk-Free Rate. The reference rate (SONIA, SOFR, ESTR, EURIBOR, FED, TONA) read from `rfr.baseRate`. |
| **PIK** | Payment in Kind. Interest that capitalises into the loan balance instead of paying in cash. The Treatment panel's PIK editor lets you toggle and parameterise it inline. |
| **Modification event** | A change to deal terms during life. Tracked in `instrument.modificationEvents[]`; the Treatment panel exposes an inline editor + sample injectors. |
| **Per-row Excel merge** | Stage 1 enrichment that fills missing rate / interest / fee / PIK fields from the engine when the PortF Excel template doesn't supply them. Per-row, never overwrites explicit values. |
| **Carrying value waterfall (gross)** | The IAS 1 §54 movement reconciliation from opening to closing carrying value, presented gross of ECL allowance per IFRS 9 §5.5. ECL appears as a memo disclosure block below. |

---

*Last updated 2026-05-08. For questions or change requests, raise a ticket against the integration layer module.*

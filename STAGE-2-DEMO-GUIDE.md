# Stage 2 Demo Guide — 13 Accounting-System Features

**Audience:** anyone demoing the Loan Module Integration Layer to PCS / Investran stakeholders, internal audit, PwC, or NWF.
**Total run-time:** ~30 minutes (5 min setup + 15 min Stage 2 walkthrough + 10 min Evidence Pack deep-dive).
**File:** `loan-module-integration-layer.html`
**Recommended demo deals:** Volt (guarantee, 4 fees) for breadth · Libra 2 (loan, IFRS 15 + ECL) for depth.

This guide walks every accounting-system capability as a numbered demo script with click-by-click instructions, expected screen content described in detail (so you know what to point at), and talking points. Use it as a script — capture screenshots as you go for any stakeholder deck.

---

## Pre-flight setup (1 minute)

1. **Open the page** — `loan-module-integration-layer.html` in any modern browser. If you've followed the GitHub setup guide, run `python3 -m http.server 8080` and visit `http://localhost:8080/loan-module-integration-layer.html`.
2. **Sticky header** — confirm you can see the top bar with: title "Loan Module Integration Layer", **Save Session** + **Load Session** buttons, **Active Deal** dropdown, **Old Loan Module** link.
3. **Pick a deal** — open the Active Deal dropdown. You'll see deals grouped by Legal Entity (FIS Capital Partners I / II, FIS Credit Opps III, FIS Direct Lending Fund IV, NWF Renewable Equity, NWF Sustainable Infrastructure). Select **Libra 2** for depth or **Volt** for breadth.
4. **Take a "before" screenshot** — five collapsible Stage cards (1 PortF Inbound · 2 PCS / Investran · 3 Workday GL Outbound · 4 Workday Actual Cash · 5 Reconciliation), all in their pre-load state.

---

## Quick demo path (the lazy 60-second tour)

If you only have 60 seconds:
1. Pick Libra 2 → **Use Active Deal as Sample** (Stage 1).
2. Click **Run Accounting** (Stage 2).
3. Click **Push DIU to Workday** (Stage 3).
4. Click **Synthesise Sample (with variances)** (Stage 4).
5. Click **Run Reconciliation** (Stage 5).
6. Open the Evidence Pack. Done — full pipeline demoed.

For the deep walkthrough, follow the 13 demo scripts below.

---

## DEMO 1 — Deal terms (Reference copy)

**Why this matters:** PCS holds the deal terms as a *reference copy* — PortF remains the system of record. We need to prove the reference copy is faithful to the source.

**Prerequisites:** No PortF data loaded.

**Steps:**
1. In the Active Deal dropdown, select **Volt - Guarantee**.
2. Stage 1 → click **Use Active Deal as Sample**.
3. Wait ~1 second for the cashflow schedule to build.
4. Expand **"View loaded setup info"** in Stage 1.

**What you should see:**
A 3-column table — Field · Value · Source — with badges:

```
┌────────────────────┬─────────────────────────────────────────────┬───────────┐
│ Field              │ Value                                       │ Source    │
├────────────────────┼─────────────────────────────────────────────┼───────────┤
│ Company            │ Volt                                        │ Seed •    │
│ Debt Type          │ —                                           │           │
│ Loan Start Date    │ 2025-12-18                                  │           │
│ Loan End Date      │ 2037-12-17                                  │           │
│ Total Commitment   │ £1,000,000,000                              │ Seed •    │
│ Currency           │ GBP                                         │ Seed •    │
│ Legal Entity       │ NWF Sustainable Infrastructure              │ Seed •    │
│ LEID               │ 42                                          │ Seed •    │
│ Position           │ NWF Guarantor Position · Volt covered tr…   │ Seed •    │
│ Position ID        │ POS-NWF-VOLT-GUAR                           │ Seed •    │
│ Income Security    │ Volt Financial Guarantee on £1bn BoA Lo…    │ Seed •    │
│ Security ID        │ SEC-VOLT-GP017-FINGUAR                      │ Seed •    │
└────────────────────┴─────────────────────────────────────────────┴───────────┘
Source: ✱ Excel · • Seed instrument · 🆕 Synthetic
```

**Demo talking points:**
- "Every field carries a provenance badge. Excel ✱ = loaded directly from the PortF Excel file. Seed • = pulled from our seed instrument record. Synthetic 🆕 = inferred when neither source carried the value."
- "Loan Start / Loan End / Total Commitment / Position / Income Security all flow through, plus IDs and the counterparty."
- "If you load via Excel, additional fields like Day Count Convention and Interest Accrues come straight from the Excel and badge as Excel ✱."

📸 **Screenshot tip:** Capture the full setup-info table including the source-legend footer.

---

## DEMO 2 — Cashflow schedules (Replicated)

**Why this matters:** PCS *replicates* the contractual cashflow grid so we can compute period-end totals deterministically. Any treatment override forces a rebuild — proving determinism.

**Prerequisites:** Stage 1 loaded; Stage 2 ready.

**Steps:**
1. Click **Run Accounting** in Stage 2.
2. Scroll down to **"View daily schedule"** — expand it.

**What you should see:**
- Header strip: row count chip ("631 of 2,559 rows · showing first 500" for Libra 2; "4,383 of 4,383 rows" for Volt).
- A filter dropdown defaulting to "Material events only" — switch through "All days" / "Month-end days only" to demo.
- Two download buttons: **Download Full CSV** (47 columns) · **JSON**.
- A 17-column preview table:

```
Date       | Balance      | Drawn     | Draw      | Repay  | Rate    | Daily Interest | Daily PIK | PIK Capit. | Daily Fees | EIR Accret. | Carrying    | ECL Alw. | ECL Δ | Mod G/L | FX | Hedge P&L
2024-10-08 | —            | —         | 25,000,000| —      | —       | —              | —         | —          | 437,500    | —           | —           | —        | —     | —       | —  | —
2024-10-13 | 25,000,000   | 25,000,000| —         | —      | 9.2500% | 6,250          | —         | —          | —          | —           | 25,006,250  | —        | —     | —       | —  | —
...
```

**Demo talking points:**
- "Engine rebuilds the schedule on every Run — so when we toggle PIK or change ECL Stage, the Daily Schedule view refreshes immediately. We'll see that in Demo 5 and 7."
- "Material event rows highlight in blue (drawdowns, fees, capitalisations, ECL movements, modification events). Zero-activity days render as `—` for readability."
- "Click **Download Full CSV** — you get every column the engine produces (47 fields from balance through hedge P&L), UTF-8 BOM, money fields rounded to 2 dp."

📸 **Screenshot tip:** Filter to "Material events only", capture the table; then switch to "All days", capture again.

---

## DEMO 3 — Interest mechanics (Consumes outputs)

**Why this matters:** PCS consumes the contractual coupon (Fixed / Floating / SONIA / SOFR / RFR + marginSchedule) and resolves the effective rate per day.

**Prerequisites:** Run Accounting completed.

**Steps:**
1. In the Stage 2 IFRS detail strip (above the journal table), find the EIR card.
2. Read the EIR field + the breakdown line.

**What you should see (Libra 2):**
```
┌─────────────────────────────────────────┐
│ EIR / IFRS 9 §B5.4                      │
│                                         │
│ 9.2500%  (coupon, no amort)             │
│                                         │
│ SONIA 4.7500% + margin 4.5000% =        │
│ 9.2500% · Drawn at par — EIR = coupon   │
└─────────────────────────────────────────┘
```

**For Volt:** `5.5900%` with breakdown `SONIA 4.7500% + margin 0.8400% = 5.5900%`.
**For Suffolk Solar (multi-tranche):** `7.3750%` with breakdown `Face-weighted across 2 tranches — coupon 7.3750%`.

**Demo talking points:**
- "EIR engine handles five rate families: Fixed, legacy Floating, RFR (SONIA / SOFR / ESTR / EURIBOR / FED / TONA), multi-tranche aggregation, and multi-underlying guarantee aggregation."
- "For RFR-driven deals like Libra 2, we read `rfr.baseRate` and the current period from `marginSchedule[]` — both the index level and the contractual margin are surfaced separately in the breakdown line."
- "When the contract changes (modification event with new spread), the engine rolls the EIR forward with the new rate. We'll see that in Demo 11."

📸 **Screenshot tip:** Capture the EIR card with breakdown line visible.

---

## DEMO 4 — Drawdowns / repayments (Receives postings)

**Why this matters:** Every contractual draw and repayment hits the GL as a balanced JE pair. The exposure side moves to the loan asset; the cash side reflects the actual receipt or disbursement.

**Prerequisites:** Run Accounting completed.

**Steps:**
1. In Stage 2, expand **"View generated journal entries (mapped to Investran chart)"**.
2. Filter the journal table mentally by transactionType containing "Drawdown".

**What you should see (Volt — 6 drawdown events × 2 sides = 12 rows):**
```
┌────────────┬────────────────────────────────────┬────────┬────────────────────┬────────┬────┬─────────────────┐
│ Date       │ Transaction Type                   │ Account│ GL Account Name    │ Amount │ DR/CR │ Notes        │
├────────────┼────────────────────────────────────┼────────┼────────────────────┼────────┼────┼─────────────────┤
│ 2026-06-30 │ Loan Drawdown                      │ 141000 │ Investments at Cost│ £133m  │ DR │ initial draw    │
│ 2026-06-30 │ Loan Drawdown — Cash               │ 111000 │ Cash               │ £133m  │ CR │ initial draw    │
│ 2026-12-31 │ Loan Drawdown                      │ 141000 │ Investments at Cost│ £133m  │ DR │ tranche 2 draw  │
│ 2026-12-31 │ Loan Drawdown — Cash               │ 111000 │ Cash               │ £133m  │ CR │ tranche 2 draw  │
... (4 more pairs)
```

**Demo talking points:**
- "Engine routes drawdowns to `141000 Investments at Cost` (DR) / `111000 Cash` (CR). Repayments reverse: `141000 Sale of investment - Notes - Return of capital` / `111000 Cash`."
- "PIK capitalisations post to `141000 Investment accretion - PIK interest`. OID accretion to `141000 Investment accretion - Original issue discount`."
- "Every JE pair is balanced — the green chip beneath the table reads `Σ DR = Σ CR · balanced`. If they ever go out of balance, an UNBALANCED chip lights red and Stage 3 push is blocked."

📸 **Screenshot tip:** Capture the journal table filtered/scrolled to drawdown rows + the balanced chip.

---

## DEMO 5 — Rate resets (Sometimes)

**Why this matters:** RFR-driven deals reset the rate every settlement period. The engine reads `marginSchedule[]` + `rfr.baseRate` and applies them per day, with daily resolution.

**Prerequisites:** Libra 2 loaded + Run Accounting completed (Libra 2 has a margin step-up via marginSchedule).

**Steps:**
1. Switch the Active Deal to **Libra 2**.
2. Stage 1 → **Use Active Deal as Sample**.
3. Stage 2 → **Run Accounting**.
4. Open **"View daily schedule"** → filter to "All days".
5. Scan the **Rate** column across the schedule. Note where it changes.

**What you should see (rate stepping up at margin window boundary):**
```
Date         | Balance       | Rate
2024-10-13   | 25,000,000    | 9.2500%
... (~12 months)
2025-10-08   | 25,000,000    | 9.7500%   ← margin step-up at +1y anniversary
... (continues)
2026-10-08   | 25,000,000    | 10.2500%  ← another step-up
```

**Demo talking points:**
- "The marginSchedule on Libra 2 has windows defining margin in bps for each period. The engine looks up the current window per day."
- "ESG adjustments are also supported — if the borrower hits a sustainability KPI, the spread can ratchet down by a configurable bps, applied from the trigger date forward."
- "All rate changes flow into the Daily Schedule's currentRate column AND into `dailyCash` interest income. The PoP Variance Walk in the Evidence Pack decomposes ΔInterest into rate × balance × days × modification effects."

📸 **Screenshot tip:** Capture the Daily Schedule with two rate windows visible side-by-side.

---

## DEMO 6 — Fees commercial terms (Accounting treatment)

**Why this matters:** PortF tells us the contractual fee terms (rate, basis, frequency). PCS decides the IFRS treatment — IFRS 9 EIR (capitalised into yield) vs IFRS 15 over-time vs IFRS 15 point-in-time — and routes to the right GL account.

**Prerequisites:** Volt loaded + Run Accounting (Volt has 2 fees with different IFRS treatments).

**Steps:**
1. In Stage 2, scroll down past the journal table to **"View fee specifications + engine-computed totals"**.
2. Click to expand.

**What you should see (Volt):**
```
┌────────────────────────┬───────────┬──────────┬───────────┬───────────┬────────┬──────────────────────┬────────────────┐
│ Fee Name               │ Kind      │ Mode     │ Frequency │ Basis     │ Rate   │ IFRS Treatment       │ Accrued (life) │
├────────────────────────┼───────────┼──────────┼───────────┼───────────┼────────┼──────────────────────┼────────────────┤
│ Volt Guarantee Fee     │ guarantee │ periodic │ SemiAnnual│ covered   │ 1.6700%│ ▓ IFRS15-overTime   │ £24,xxx,xxx    │
│ NWF Commitment Fee     │ commitment│ periodic │ SemiAnnual│ unfunded  │ 0.2900%│ ▓ IFRS15-overTime   │ £2,xxx,xxx     │
└────────────────────────┴───────────┴──────────┴───────────┴───────────┴────────┴──────────────────────┴────────────────┘
                                                                                  Total fees (life): £26,479,026
```

3. Now scroll up to the **Editable Treatment Panel** (above the capability grid). Find section **E. Per-fee IFRS 15 treatment**.
4. Open one of the per-fee dropdowns (e.g. NWF Commitment Fee). Change `IFRS 15 — recognised over time` to `IFRS 9 — capitalised into EIR`. **Tab out of the field**.
5. Watch Stage 2 auto re-run. Capability cards refresh, journal table re-renders.

**What changes (with the override applied):**
- The Commitment Fee rows in the journal table now post to `421000 Investment Interest Income` (capitalised into yield) instead of `492200 Commitment Fee Income`.
- The Modification History panel logs a new run flagged with an "override" chip.
- Fee Specifications panel chip flips from `IFRS15-overTime` (green) to `IFRS9-EIR` (blue).

6. Click **Reset to defaults** in the Treatment panel to revert.

**Demo talking points:**
- "Fee kind drives default IFRS treatment. Arrangement → IFRS 9 EIR. Commitment / Guarantee / Management → IFRS 15 over time. Dividend → IFRS 15 point in time."
- "Each fee routes to a dedicated GL account: 492100 Arrangement / 492200 Commitment / 492300 Guarantee / 492400 Management / 492500 Dividend Equity."
- "The Treatment override is per deal, persists across runs, and shows up in the audit trail. If reviewer Jane changes a fee's treatment for the May close, the run history records exactly when, by whom, and what changed."

📸 **Screenshot tip:** Two screenshots — before-override Fee Specifications panel + after-override (with the IFRS 9-EIR chip).

---

## DEMO 7 — Accrual generation (Sometimes recalculated)

**Why this matters:** Engine REGENERATES accruals every Run Accounting. Treatment changes flow into journals immediately — no manual re-keying, no stale state.

**Prerequisites:** Libra 2 loaded + Run Accounting completed.

**Steps:**
1. Note the current KPIs in Stage 2:
```
Total Interest (life): £13,361,596
Total Fees (life):     £1,005,901
Total PIK (life):      £0
EIR Accretion:         £0
JE Rows Generated:     18
```
2. Scroll to the Treatment panel → section C-tris **PIK Interest (contractual override)**.
3. Change **PIK enabled** to "Yes — capitalises into balance".
4. Set **PIK rate (annual)** to `0.03` (3%).
5. Set **Capitalisation frequency** to `Quarterly`.
6. Tab out of the field.

**What changes immediately:**
```
Total Interest (life): £14,489,690   ← +£1.13m (PIK accrues on growing balance, lifting cash interest)
Total Fees (life):     £1,005,901
Total PIK (life):      £4,470,390    ← was £0
EIR Accretion:         £0
JE Rows Generated:     ~22           ← +4 PIK capitalisation entries
```

The Daily Schedule view's "Daily PIK" and "PIK Capit." columns now show non-zero values. New JE rows appear: `Investment accretion - PIK interest` posting to `141000`.

7. Click **Reset to defaults** to revert.

**Demo talking points:**
- "Every Run rebuilds `M.schedule` and `M.summary` from the current instrument state at the top of the function. So changing PIK, ECL Stage, FV Level, fee treatment, or modification events flows immediately into the journals."
- "This is the single most important behaviour for the demo: the engine is fully deterministic and 100% live. No 'click here to refresh' — every change cascades."
- "Stages 3-5 invalidate cleanly when journals change. The Workday batch is cleared, recon is cleared, the operator must re-push to keep them in sync."

📸 **Screenshot tip:** Side-by-side KPI strips — pre-PIK and post-PIK — showing the £4.47m PIK life jump.

---

## DEMO 8 — Amortised cost (Primary owner)

**Why this matters:** PCS owns amortised-cost measurement. The Carrying Value Waterfall reconciles from opening to closing carrying value with every IFRS 9 movement itemised.

**Prerequisites:** Volt loaded + Run Accounting completed (Volt has £1.92m of deferred fees, demonstrating the upfront IFRS 15 EIR-included accretion).

**Steps:**
1. Switch to Volt → **Use Active Deal as Sample** → **Run Accounting**.
2. Open the Evidence Pack.
3. Expand **"Subsequent Measurement — Carrying Value Waterfall"**.

**What you should see:**
```
┌──────────────────────────────────────────────────────────┬──────────────┐
│ Movement                                                 │ GBP          │
├──────────────────────────────────────────────────────────┼──────────────┤
│ Opening principal balance                                │           £0 │
│ − Deferred fees at recognition (IFRS 9 EIR)              │  (£1,919,562)│
│ ─────────                                                                │
│ = Opening carrying value (gross)                         │  (£1,919,562)│
│ + Drawdowns                                              │ £800,000,000 │
│ − Repayments                                             │(£755,555,555)│
│ + EIR Accretion (IFRS 9 §B5.4)                           │  £1,920,438  │
│ + Discount / OID amortisation                            │  £0          │
│ + PIK Capitalised                                        │  £0          │
│ + Modification gain / loss (IFRS 9 §5.4.3)              │  £0          │
│ + Hedge P&L (IFRS 9 §6)                                  │  £0          │
│ + FX Revaluation                                         │  £0          │
│ ─────────                                                                │
│ Closing carrying value (gross)                           │ £44,444,883  │
└──────────────────────────────────────────────────────────┴──────────────┘
✓ Waterfall ties to closing carrying value (gross)        Days in period: 4,383

┌─────────────────────────────────────────────────────────────────────────┐
│ Memo — ECL Allowance Disclosure (IFRS 9 §5.5)                           │
│                                                                         │
│ Closing carrying value (gross): £44,444,883                             │
│ Less: ECL allowance:           (£70,000)                                │
│ ─────────                                                                │
│ Net carrying value:            £44,374,883                              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Demo talking points:**
- "Opening carrying value is NOT principal balance — for deals with IFRS 15 EIR-included fees (like Volt's arrangement fee), day-1 carrying is negative because the fee is deferred and accreted into income over life."
- "Every IFRS movement is itemised: drawdowns, repayments, EIR accretion (recognises the deferred fee), OID amort, PIK capitalisation, modification gain/loss, hedge P&L, FX. ECL is presented separately as a memo per IFRS 9 §5.5 contra-asset disclosure."
- "Tie chip is green when waterfall sums to closing carrying within £1. Acceptable rounding residual is sub-£500 for multi-thousand-day deals."

📸 **Screenshot tip:** Capture the waterfall + ECL memo block + the green tie chip.

---

## DEMO 9 — EIR calculation (Usually owner)

**Why this matters:** PCS owns the EIR calculation. Engine handles 5 coupon families and recursively aggregates for multi-tranche / multi-underlying wrappers.

**Prerequisites:** None (we'll switch through 4 deals).

**Steps:** Switch the Active Deal dropdown across these four — Run Accounting after each:

| Deal | Coupon family | Expected EIR display |
|---|---|---|
| Alliance Manufacturing | Fixed | `12.0000% (coupon, no amort)` · breakdown: `Fixed coupon 12.0000%` |
| Volt | SONIA + spread | `5.5900%` · breakdown: `SONIA 4.7500% + margin 0.8400% = 5.5900%` |
| Libra 2 | SONIA + marginSchedule | `9.2500%` · breakdown: `SONIA 4.7500% + margin 4.5000% = 9.2500%` |
| Suffolk Solar | Multi-tranche | `7.3750%` · breakdown: `Face-weighted across 2 tranches — coupon 7.3750%` |

**Demo talking points:**
- "Engine handles Fixed, legacy Floating (SOFR-style explicit floatingRate), RFR families (SONIA / SOFR / ESTR / EURIBOR / FED / TONA) reading rfr.baseRate + marginSchedule, and multi-tranche / multi-underlying aggregation."
- "Multi-tranche EIR is face-weighted across the children. The aggregator strips the wrapper arrays before recursing to prevent infinite loops."
- "The breakdown line is the auditor's friend — they can verify the rate composition without hunting through the engine code."

📸 **Screenshot tip:** Four screenshots — one per deal — showing the EIR card with breakdown.

---

## DEMO 10 — GL journals (Primary output)

**Why this matters:** The DIU XLSX is Stage 2's primary deliverable. Two tabs (GL + PortfolioPosition), 25 columns each, balanced, sanitised, and conforming to the Investran Sec master template.

**Prerequisites:** Volt loaded + Run Accounting completed.

**Steps:**
1. In Stage 2, click **Filled DIU XLSX**.
2. Open the downloaded file `investran-diu-voltGuarantee-{date}.xlsx`.

**What you should see — Tab 1: GL** (25 columns):
```
effectiveDate · glDate · transactionType · account · glAccountName · glTransType ·
amountLE · isDebit · fx · amountLocal · originalAmount · allocationRule (= "No Allocation") ·
legalEntity · leid · deal · issuer · Security · incomeSecurity ·
batchId · batchType · batchComments · transactionComments · jeIndex · txIndex · leDomain (= "NWF")
```

For Volt, 58 rows. For each event:
- effectiveDate = real economic event date
- glDate = period close date (default today / "AUTO" mode = effectiveDate)
- allocationRule = "No Allocation" for every row
- leDomain = "NWF" for every row
- deal column = "Volt"
- issuer column = "Volt" (same as deal)
- Security column = "NWF Guarantor Position · Volt covered tranche" (formerly "position")
- incomeSecurity = "Volt Financial Guarantee on £1bn BoA Loan (£800m covered)"

**What you should see — Tab 2: PortfolioPosition** (15 columns matching the Investran Sec master):
```
Legal Entity ID · Legal Entity · Legal Entity Domain ·
Deal · Deal Type · Deal Domain · Deal Currency ·
Issuer · Issuer Domain · Issuer Linked Organization · Issuer Linked Organization Domain · Issuer Currency ·
Security · Security Type · Security Currency
```

For Volt — 1 row:
```
42 · NWF Sustainable Infrastructure · NWF ·
Volt · Guarantee · NWF · GBP ·
Volt · NWF · Volt · NWF · GBP ·
Volt Financial Guarantee on £1bn BoA Loan (£800m covered) · Financial Guarantee · GBP
```

For multi-security deals (Suffolk Solar, Volt Multi-Loan), the PortfolioPosition tab has one row per child security automatically.

**Demo talking points:**
- "DIU XLSX is the file Investran's DIU API ingests. Two tabs match what Investran expects: GL with the journal entries, PortfolioPosition with the security master."
- "All Unicode is sanitised to ASCII (en-dash, section symbol, middle-dot replaced) so legacy Excel and downstream ETL tools read cleanly. UTF-8 BOM prepended."
- "Money fields rounded to 2 decimal places. fx ratio kept at full precision."
- "GL Posting Date is operator-controlled. AUTO mode (default) uses effectiveDate per row. Set a date in the picker to override every row to that close date."

📸 **Screenshot tip:** Two screenshots — GL tab with the 25 columns visible + PortfolioPosition tab with the 15 columns visible.

---

## DEMO 11 — IFRS disclosures (Evidence Pack)

**Why this matters:** Six disclosure-grade panels covering everything the audit and disclosure note authors ask for.

**Prerequisites:** Libra 2 loaded + Run Accounting completed.

**Steps:** Open the Evidence Pack section. Walk through each panel.

### A. Month-End Close + Run Metadata
- **What:** Run ID (`PCS-20260509-LIBRA2-XXXXXXXX`), Version (`v1`), Effective Date, Run Date, User, Period bounds, JE Rows, Status workflow chip (`Draft → Reviewed → Approved → Posted`).
- **Demo:** Click **Reviewer sign-off** → status flips to Reviewed (Draft chip green, Reviewed blue). Click **Approve** → Approved. Click **Post (lock period)** → all 4 chips green, **Period Locked** banner appears with **Unlock period** + **Start new versioned run** buttons.

### B. Carrying Value Waterfall (IAS 1 §54)
- Already covered in Demo 8. Show the gross → ECL memo → net structure.

### C. Period-on-Period Variance Walk (PoP)
- **What:** Decomposes ΔInterest between two halves of the schedule into Rate × Balance × Days × Modification × Cross/mix residual.
- **Demo:** "When leadership asks 'why did interest income jump £400k between Q3 and Q4?', this panel attributes the change to specific drivers."

### D. Fair Value Sensitivities (IFRS 13 §93)
- **What:** Sensitivity set branches by FV Level. Level 1 = price shocks; Level 2 = ±50/±100 bps rate + ±50 bps spread; Level 3 = ±150 bps stress + ±100 bps spread + ±200 bps illiquidity premium + ±5% recovery rate + significant unobservable inputs disclosure.
- **Demo:** In the Treatment panel, change FV Level to "Level 3" → panel renders 7 stress shocks + the "Significant unobservable inputs" table (PD live from instrument, LGD live, illiquidity premium, cashflow volatility).

### E. IFRS 9 ECL Journal Templates
- **What:** Six template entries showing the canonical DR/CR pattern for Initial recognition (Stage 1), Stage 1→2 transition, Stage 2→3 (credit-impaired), Stage 3→2 cure, default/write-off, and post-write-off recovery.
- **Demo:** "These are reference templates with illustrative amounts — the engine substitutes the actual ECL movement for the period when posting."

### F. Modification Before/After + Audit Run History
- **What:** EIR before vs after substantial-mod table; modification events on the schedule; last 10 runs across all deals with run ID, version, when, user, status, JE rows, treatment-policy flag.
- **Demo:** Click **Add Test Modification** in the Treatment panel → run history logs a new override-flagged entry. Show the Substantial vs Non-substantial mod handling.

📸 **Screenshot tips:** One screenshot per panel — six total. The Mod History run-history table is particularly compelling for auditors.

---

## DEMO 12 — ECL reserve booking

**Why this matters:** PCS books the IFRS 9 §5.5 expected credit loss as a contra-asset against the loan, with movement to P&L impairment expense.

**Prerequisites:** Libra 2 loaded + Run Accounting completed.

**Steps:**
1. In the Stage 2 journal table, scroll to find:
```
2031-10-10 │ Impairment Expense (ECL)             │ 470000 │ Impairment / ECL Expense (IFRS 9 §5.5)│ £42,500 │ DR
2031-10-10 │ Loan Loss Allowance (Contra-Asset)   │ 145000 │ Loan loss allowance – IFRS 9 ECL      │ £42,500 │ CR
```
2. In the Treatment panel, change **ECL Stage** from `Stage 1` to `Stage 2`.
3. Stage 2 auto re-runs — the ECL allowance jumps from £42,500 to ~£185,000 (lifetime ECL vs 12-month). The DR Impairment / CR Allowance amounts increase.
4. Open the Evidence Pack → "IFRS 9 Impairment — ECL Journal Templates" section. See the six canonical templates.

**Demo talking points:**
- "ECL is computed as PD × LGD × EAD × CCF × stage curve. For Libra 2 at Stage 1 with PD=0.5% and LGD=40%: 0.5% × 40% × £25m = £50k notional, scaled by stage and time."
- "Stage migration is a treatment override — the operator can flip Stage 1→2→3 to demo what happens during SICR (Significant Increase in Credit Risk) or credit-impairment events."
- "Templates panel covers all 6 transitions for the audit team to verify each entry pattern."

📸 **Screenshot tip:** Before/after journal table + the ECL Templates panel.

---

## DEMO 13 — Fair value overlays

**Why this matters:** PCS computes IFRS 13 fair-value sensitivities for FVTPL/FVOCI deals (balance-sheet measurement) AND for amortised-cost deals (IFRS 7 §25 disclosure note).

**Prerequisites:** Libra 2 loaded (AmortisedCost) + Run Accounting completed.

**Steps:**
1. Note the FV display in Stage 2's IFRS detail strip:
```
Fair Value (IFRS 13)
Disclosure-only · Level 2
Amortised cost on balance sheet · IFRS 7 §25 FV note tagged Level 2 (Observable inputs (curves, comparable transactions))
```
*Note: if FV Level is not set, you'll see "Disclosure-only — Level not set" with a prompt to set it.*

2. Open the Evidence Pack → **"Fair Value Sensitivities (IFRS 13 §93)"**.

**What you should see (Level 2 default):**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Level 2 — Observable inputs other than quoted prices (IFRS 13 §81)      │
│ Inputs corroborated by market data. Standard rate + credit spread       │
│ sensitivities.                                                          │
│ Asset is at amortised cost — same approximation feeds IFRS 7 §25 FV     │
│ note disclosure.                                                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────┬──────────────┬─────────────────────┐
│ Scenario                            │ ΔFV (GBP)    │ ΔFV % of carrying   │
├─────────────────────────────────────┼──────────────┼─────────────────────┤
│ +100 bps parallel rate shift        │ −£0          │ 0.0000%             │
│ +50 bps parallel rate shift         │ −£0          │ 0.0000%             │
│ −50 bps parallel rate shift         │ +£0          │ 0.0000%             │
│ −100 bps parallel rate shift        │ +£0          │ 0.0000%             │
│ +50 bps credit spread widening      │ −£0          │ 0.0000%             │
│ −50 bps credit spread tightening    │ +£0          │ 0.0000%             │
└─────────────────────────────────────┴──────────────┴─────────────────────┘

Modified duration ≈ Xy based on Yy life · carrying £Z

┌─────────────────────────────────────────────────────────────────────────┐
│ Key inputs disclosure                                                   │
├──────────────────────────────────┬──────────────────────────────────────┤
│ Reference yield curve            │ SONIA / SOFR observable curve        │
│ Credit spread                    │ Comparable peer-spread basket        │
│ FX rate                          │ Spot + forward curve                 │
└──────────────────────────────────┴──────────────────────────────────────┘
```

3. In the Treatment panel, change **Fair Value Level** to "Level 3". Wait for re-render.
4. Same panel re-populates with 7 stress shocks (±150 bps rate, ±100 bps spread, ±200 bps illiquidity premium, ±5% recovery rate) plus a "Significant unobservable inputs" table showing the live PD and LGD pulled from the instrument.

**Demo talking points:**
- "FV Level is editable in the Treatment panel. Even amortised-cost deals carry a FV level for the IFRS 7 §25 disclosure note — the engine surfaces both."
- "Level 1 / 2 / 3 each get a different sensitivity set per the standard's requirements."
- "Level 3 unobservable inputs disclosure is mandatory under IFRS 13 §93(d) and the panel has the live values right there."

📸 **Screenshot tip:** Three screenshots — Level 1 (price shocks), Level 2 (rate/spread shocks + observable inputs), Level 3 (stress shocks + unobservable inputs disclosure).

---

## Wrap-up: the 5-stage pipeline reveal

After the 13 deep-dive demos, demonstrate the full pipeline in 60 seconds:

1. **Stage 3** → click **Push DIU to Workday** → external key generated, balance check passes (`Σ DR = Σ CR · balanced` chip).
2. **Stage 4** → click **Synthesise Sample (with variances)** → 5 actuals batches load with 1 amount variance + 1 timing variance baked in.
3. **Stage 5** → click **Run Reconciliation** → 3 tied / 2 breaks / KPI strip + per-line table populate.
4. Click **Send Feedback to PortF** → `portf-feedback-{deal-id}-{date}.json` downloads. This is what PortF's deal team would pick up to investigate the breaks.

📸 **Screenshot tip:** Capture all 5 Stage cards in their "done" state (green borders) for a satisfying full-pipeline shot.

---

## Bonus tips for stakeholder demos

| Stakeholder | What to emphasise | Best deal |
|---|---|---|
| Auditors / PwC | Capability cards · Carrying Value Waterfall · ECL Templates · Modification History | Libra 2 (clean amortised cost) |
| Workday team | Stage 3 DIU push · GL Posting Date control · CSV sanitisation · external key idempotency | Any deal — focus is on the output format |
| PortF deal team | Stage 1 Excel/JSON load · Setup info source badges · Stage 5 feedback payload | Volt (rich fee structure) |
| Risk / Stress Testing | FV Sensitivities Level 3 · ECL Stage migration · Modification accounting | Libra 2 + manually flip ECL Stage |
| NWF Finance Ops | Save/Load Session · Stage 4 multi-batch periods · Daily Schedule CSV export | Volt — show monthly close workflow |

## Stakeholder script: the elevator pitch

> "PortF is the system of record. PCS / Investran is the IFRS-aligned accounting engine. Workday is the General Ledger. This integration layer orchestrates them with full reconciliation back to PortF.
>
> Stage 1 ingests cashflows. Stage 2 produces IFRS-compliant journals — covering 13 of the 17 accounting-system capabilities including amortised cost, EIR, ECL, fair value, modifications, hedge accounting, and full IFRS 7/9/13/15 disclosure support. Stage 3 pushes journals to Workday with idempotent retries. Stage 4 ingests actual cash. Stage 5 reconciles and feeds breaks back to PortF for investigation.
>
> Every output is fully auditable: deterministic engine, versioned runs, segregation-of-duties workflow, source-tracked metadata, balanced double-entry. Every change cascades — toggle PIK or migrate ECL Stage and the journals refresh in 200ms."

---

## Demo file inventory (output downloads to capture)

| File | Stage | What to do with it |
|---|---|---|
| `schedule-{deal}-{date}.csv` (47 cols) | 2 | Open in Excel — show all engine fields |
| `schedule-{deal}-{date}.json` | 2 | Show structured envelope (deal + runMeta + summary + schedule) |
| `investran-diu-{deal}-{date}.xlsx` (GL + PortfolioPosition tabs) | 2 | The headline deliverable. Open in Excel — show 25-col GL + 15-col PortfolioPosition |
| `workday-diu-{deal}-{date}.csv` | 3 | Slim 12-col CSV (legacy operator format) |
| `portf-feedback-{deal}-{date}.json` | 5 | Show stakeholders what PortF receives — break details + requestedActions array |
| `lmil-session-{deal}-{date}.json` | any | Save/Load — proves state can persist and reload |

---

## Troubleshooting common demo issues

| Issue | Fix |
|---|---|
| "Run Accounting" disabled | Stage 1 not loaded — click **Use Active Deal as Sample** first |
| EIR field shows 0% | Refresh the page — earlier engine version had this bug for SONIA deals |
| Total Interest = 0 on Volt | Correct — Volt is a guarantee, NWF earns guarantee fee not loan interest. Total Fees should be £26.48m |
| 18 JEs on Libra 2 | Correct — that's the period-end summarisation. The 2,559 daily rows roll up to 18 economic events |
| Modal won't close | Click anywhere outside the modal panel, or the × button top-right |
| Save Session shows 0 deals | The default seed list isn't saved — only deals you've operated on appear |
| Multiple deals on same legal entity | Use the dropdown's optgroup-by-LE structure to find them |

---

*Demo guide last updated 2026-05-09. Tested against Libra 2, Volt, Suffolk Solar, and Volt Multi-Loan.*

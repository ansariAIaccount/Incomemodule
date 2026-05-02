# Fees & IFRS Treatment — Income Calculator

The calculator now models multiple fee types alongside interest accrual, with each fee carrying an explicit IFRS classification that drives how it is recognised and reported.

## Fee data model

Each instrument has a `fees: []` array. Each fee entry:

| Field | Values | Notes |
|-------|--------|-------|
| `kind` | `arrangement \| commitment \| guarantee \| other` | Drives default GL accounts |
| `mode` | `percent \| flat` | `percent` = rate × base × dcf; `flat` = explicit £ |
| `rate` | decimal | e.g. `0.0175` = 1.75% |
| `amount` | £ | Used when `mode='flat'` |
| `base` | `commitment \| undrawn \| drawn \| covered \| face` | Notional the rate applies to |
| `frequency` | `oneOff \| daily \| monthly \| quarterly \| semiAnnual \| annual` | Drives accrual + payment cadence |
| `paymentDate` | ISO date | One-offs use this; periodic fees use the schedule |
| `accrueFrom` / `accrueTo` | ISO | Optional — defaults to settlement → maturity |
| `ifrs` | `IFRS9-EIR \| IFRS15-overTime \| IFRS15-pointInTime` | Drives recognition logic |

## IFRS 9 — Amortised cost & EIR-included fees

Fees that are integral to the loan's effective interest rate (arrangement fees, OID, structuring fees, certain origination costs) are flagged `IFRS9-EIR`. The calculator:

1. At t₀, totals the fees with `frequency='oneOff'` and `ifrs='IFRS9-EIR'` into a `deferredEIRPool`.
2. Reduces the carrying value at origination by that pool (mirroring the contra-asset for deferred income).
3. Accretes the pool back into interest income each day at `deferredEIRPool / lifeDays`, increasing carrying value and creating an `EIR Fee Accretion` JE pair (DR loan carrying / CR interest income).
4. Surfaces this as the `EIR Accretion (IFRS 9)` KPI and a column in the daily schedule.

This is the standard IFRS 9 §B5.4.1–B5.4.7 treatment — fees integral to the EIR are deferred and recognised over the expected life of the financial instrument.

## IFRS 15 — Service-style fees

Fees that compensate the lender for an ongoing service obligation (commitment fee on undrawn capacity, guarantee fee on covered exposure) or a discrete service (e.g. upfront amendment fee) are flagged either:

- `IFRS15-overTime` — recognised pro rata across the service window (`accrueFrom` → `accrueTo`). Daily accrual with the chosen `base` (typically `undrawn` or `covered`).
- `IFRS15-pointInTime` — recognised in full on `paymentDate` when the performance obligation is satisfied.

The calculator emits a `Fee Income` JE pair per fee label (CR fee income / DR fee receivable) summed over the accrual window.

## Worked example — Libra 2 / SP023

The included `libra2` instrument (NWF Sustainable Infrastructure · HSBC Facility B4, £25M) demonstrates the full surface:

| Fee | Mode | Base | Rate | Frequency | IFRS | Treatment |
|-----|------|------|------|-----------|------|-----------|
| Arrangement Fee | percent | commitment | 1.75% | oneOff | IFRS9-EIR | £437,500 deferred → accreted over loan life (£171/day × 2,559 days) |
| Commitment Fee | percent | undrawn | 0.35% | quarterly | IFRS15-overTime | Daily on undrawn, paid quarterly |

Interest:
- Coupon type `SONIA` (Compounded RFR + Margin)
- 8-step margin ratchet (400 bps → 525 bps over the term)
- ESG adjustment of −2.5 bps from 22 May 2025
- 5 RFR Banking Days lookback
- Modified Following business day convention
- ACT/365 day basis

For period 17/2/2026 → 31/3/2026 (43 days following the £15M actual drawdown):

| Line | Amount | Notes |
|------|--------|-------|
| Interest accrual | £163,017 | £15M × 9.225% × 43/365 |
| EIR fee accretion | £7,354 | £437,500 ÷ 2,559 × 43 |
| Commitment fee | £4,123 | £10M undrawn × 0.35% × 43/365 |

## GL accounts emitted

| Account | Transaction type |
|---------|------------------|
| 40100 | Interest Income / EIR Fee Accretion (IFRS 9) |
| 40110 | Loan carrying value contra (EIR offset) |
| 40150 | Discount Accretion / PIK Capitalization |
| 40200 | Non-use Fee Income |
| 40250 | Fee Income (IFRS 15) — Arrangement / Commitment / Guarantee |
| 23000 | Interest Receivable |
| 23100 | Non-use Fee Receivable |
| 23150 | Fee Receivable (IFRS 15) |

Adjust per tenant chart.

## What's not modelled (yet)

- ECL provisioning (Stage 1/2/3) — fields are captured (`pdAnnual`, `lgd`, `ecLStage`) but the daily loop doesn't yet post a provision JE. The hook is there.
- Fallback reference rates if SONIA is unavailable (the requirements sheet calls for central bank fallback).
- Margin capitalisation (full/partial) and cash-vs-capitalised commitment fees.
- Fee ratchets (time/performance-based fee % steps, parallel to margin ratchets).
- Independent payment schedules for guarantee + commitment fees (currently uses the single `frequency` field).

These are next-step extensions — the data model has the seams cut for them.

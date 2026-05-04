# Private Equity Loan Calculator — User Guide

A self-contained, browser-only tool that models the income, fees, and accounting treatment of PE-style debt, guarantee, and equity instruments. Single HTML file — open it in Chrome, no install required. No data leaves your machine.

---

## Table of contents

1. [What it does](#1-what-it-does)
2. [The screen, tab by tab](#2-the-screen-tab-by-tab)
3. [Picker model — LE → Deal → Position → Security](#3-picker-model)
4. [Adding & saving instruments](#4-adding--saving-instruments)
5. [Income Security data model](#5-income-security-data-model)
6. [Calculation logic — what the engine does daily](#6-calculation-logic)
7. [Fees · IFRS 9 / IFRS 15 treatment](#7-fees--ifrs-9--ifrs-15-treatment)
8. [Coupon / SONIA / margin ratchets / ESG](#8-coupon--sonia--margin-ratchets--esg)
9. [Multi-tranche & multi-underlying-loan structures](#9-multi-tranche--multi-underlying-loan-structures)
10. [Default interest & default fees](#10-default-interest--default-fees)
11. [IFRS 9 ECL provisioning](#11-ifrs-9-ecl-provisioning)
12. [Multi-currency FX revaluation](#12-multi-currency-fx-revaluation)
13. [IFRS 9 modification accounting](#13-ifrs-9-modification-accounting)
14. [IFRS 9 hedge accounting (CFH / FVH)](#14-ifrs-9-hedge-accounting)
15. [Cash flow forecast & maturity ladder (IFRS 7)](#15-cash-flow-forecast--maturity-ladder)
16. [DIU export (general ledger output)](#16-diu-export)
17. [Investran adapters (CRM v2 inbound + DIU outbound)](#17-investran-adapters)
18. [Worked examples](#18-worked-examples)
19. [Common scenarios — how-to](#19-common-scenarios)
20. [Reconciling against external software](#20-reconciling-against-external-software)
21. [Persistence & data safety](#21-persistence--data-safety)
22. [Glossary of GL accounts](#22-glossary-of-gl-accounts)

---

## 1. What it does

For each income security / position / guarantee / equity holding, the calculator:

- Builds a **daily schedule** from settlement → maturity capturing balance, drawn vs undrawn, coupon rate, daily interest, PIK accrual, capitalisation, fee accrual, EIR fee accretion, default interest, FX revaluation, ECL provisioning, modification gain/loss, and hedge accounting movements.
- Aggregates into **period summaries** with KPIs.
- Generates **double-entry GL postings (DIU export)** matching FIS Investran's Data Import Utility format.
- Produces a **cash flow forecast / maturity ladder** in the standard IFRS 7 buckets.
- Stores user-created instruments in **localStorage** so they persist across reloads.

It implements (where applicable) IFRS 9 §B5.4 (EIR, modification), §5.5 (ECL), §6 (hedge accounting), and IFRS 15 (over-time and point-in-time fee revenue).

---

## 2. The screen, tab by tab

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Sidebar                  │ Main area                                    │
│ ─ Add New Instrument     │  [Setup] [Schedule] [Summary] [DIU Export]   │
│ ─ Legal Entity ▾         │                                              │
│ ─ Deal ▾                 │  Tab content here                            │
│ ─ Position ▾             │                                              │
│ ─ Income Security ▾      │                                              │
│ ─ Resolved Security      │                                              │
│   (read-only readout)    │                                              │
│ ─ Accrual Window         │                                              │
│   Begin / End / Last     │                                              │
└──────────────────────────┴──────────────────────────────────────────────┘
```

### Setup tab
The instrument editor. Sub-cards:
- **Income Security Type** — preset templates (#1–#21 from the requirements catalogue: PIK Note, Discount Bond, Floating Rate with Caps/Floors, Non-use Fee Facility, etc.). Picking a type pre-fills coupon style, amortisation method, PIK toggle, etc.
- **Loan Information** — face value, purchase price, commitment, covered amount (guarantees), settlement / amortisation start / amortisation end / maturity dates, holiday calendar, principal repayment style, accrual conventions.
- **Current Interest Terms** — coupon type (Fixed / Floating / Compounded SONIA), rate, spread, day basis, accrual frequency, PIK enable + rate + capitalisation frequency, caps / floors, non-use fee.
- **Calculation Method** — Simple Daily Accrual / Straight-line Amortisation / Effective Interest (Price / Formula / IRR override).
- **Principal Schedule** — drawdown / repayment / capitalisation events with date, type (initial / draw / paydown / repayment), and amount.
- **Fees · IFRS 9 / 15 Treatment** — the multi-fee table; per-fee classification, mode (percent / flat / margin-linked), base, frequency, payment date, IFRS treatment (IFRS9-EIR / IFRS15-overTime / IFRS15-pointInTime), feeRateSchedule.
- **SONIA / RFR · Margin Ratchet & ESG** — date-effective margin steps in bps, base SONIA fix, lookback period, ESG adjustment, business-day convention.
- **Hedge Accounting (IFRS 9 §6)** — hedge type (None / CFH / FVH), notional, fixed/floating leg rates, effectiveness ratio, editable Fair Value Schedule table (date + MTM), and editable Settlement Dates table for CFH reclassification. See §14 for full detail.

### Schedule tab
Day-by-day grid. Two density controls:

- **Show rows**: Every day · Event days & rate changes · Month-ends (default) · Quarter-ends · Year-ends · Monthly aggregates · Quarterly aggregates · Annual aggregates.
- **Columns**: Essentials · All columns · Rates & balance · Income & fees.

Aggregate-mode rows are visually distinct (blue background). The grid count chip shows "84 rows (3% of 2,559 day rows)" so you always know what slice you're seeing. CSV download exports the *underlying daily* schedule regardless of density.

### Summary tab
- **KPI strip** — Accrued Interest, Accrued PIK, Total Fees (period), EIR Accretion, Closing Balance, Carrying Value, Effective Yield.
- **Daily Accrual chart** — Cash vs PIK over time.
- **Loan Balance chart** — outstanding balance + carrying value.
- **Per-Period Roll-up** — monthly summary table.
- **EIR / Yield Analytics** — implied YTM, cash yield, effective yield, total return.
- **Cash Flow Forecast & Maturity Ladder** — IFRS 7 liquidity buckets with per-bucket stacked bar showing principal / interest / fees / EIR / default split.

### DIU Export tab
The double-entry GL postings the engine produced for the active period. Download as CSV — drop directly into Investran DIU.

---

## 3. Picker model

The four dropdowns on the sidebar mirror the **Investran CRM v2 hierarchy**:

```
Legal Entity
  └─ Deal
       └─ Position           (LE's holding of a Security; 1:1 with a Security)
            └─ Income Security  (the contract — coupon, maturity, day count)
```

- **Position → Security is 1:1.** Picking a Position uniquely resolves the Security.
- **A Security can have many Positions.** The same syndicated loan held by FCP-I and FCP-II shows up as two Positions sharing one `securityId`.
- The **Resolved Security** read-out below the picker shows the contract name, `securityId`, `positionId`, and a chip if the security is held under multiple positions (multi-LE syndicate detection).
- **Income Security dropdown** is a "jump anywhere" alternative — it always shows all instruments grouped by LE so you can navigate directly without going through the cascade.

---

## 4. Adding & saving instruments

Click **+ Add New Instrument** (top of sidebar) to open the wizard:

| Field | Notes |
|---|---|
| Legal Entity | Pick from the dropdown of known LEs, or type a new name in the adjacent free-text field |
| Refresh from Investran | Paste the JSON output of `python scripts/investran_inbound.py --all-les`; cached to localStorage and merged into the dropdown |
| Deal | Autocomplete from existing deals under the picked LE; type a new name to create one |
| Position | Free-text holding name (e.g., "FCP-I 100% holding · Athena Senior") |
| Position ID | Auto-generated slug; override if needed |
| Income Security | Free-text contract name (e.g., "Athena Senior Term Loan SONIA + 425") |
| Security ID | Auto-generated slug; override if needed |
| Instrument Kind | Loan / Guarantee / Equity-Fund / Equity-Direct |
| Currency | GBP / USD / EUR |
| Day Basis | ACT/365 / ACT/360 / ACT/ACT / 30/360 |
| Coupon Type | Fixed / Floating / SONIA |
| Face Value · Purchase Price · Commitment | Sized in the chosen currency |
| Coupon Rate | Decimal (e.g., 0.08 = 8%) |
| Settlement Date · Maturity Date | ISO dates |

On Save:
- A `user-XXXX` id is generated and the instrument is added to the in-memory dataset.
- `isUserCreated: true` flag tags it so the engine can distinguish from seed examples.
- The instrument is **persisted to `localStorage`** under key `pe-loan-calc.user-instruments.v1`.
- Subsequent edits via the form auto-save back to localStorage on every render.

A green **"User-saved"** chip appears in the resolved-security readout, with a delete button. Seed instruments show a gray "Seed" chip and can't be deleted.

To **edit** later: pick the instrument, change anything in the Setup tab — changes auto-persist.

To **clear all user instruments**: open DevTools console and run `localStorage.removeItem('pe-loan-calc.user-instruments.v1')`, then reload.

---

## 5. Income Security data model

Each instrument is a flat object. The full surface (every field optional except `id` / `legalEntity` / `deal` / `position` / `incomeSecurity`):

```js
{
  id: 'libra2',                     // Unique id, used as the active-instrument key
  positionId: 'POS-NWF-LIBRA2-100', // CRM v2 position GUID/code
  securityId: 'SEC-LIBRA2-HSBC-FACB4', // CRM v2 security GUID/code
  isUserCreated: false,             // True if user-saved (vs seed)

  // ----- Identity / hierarchy -----
  legalEntity: 'NWF Sustainable Infrastructure',
  leid: 42,
  deal: 'Libra 2',
  position: 'NWF 100% Bilateral Position · Libra 2',
  incomeSecurity: 'HSBC Facility B4 — Libra 2 (Compounded SONIA + Ratcheted Margin)',
  counterpartyId: 'SP023', transactionId: 'SP023', bilateralFlag: 'Bilateral',
  agentName: 'HSBC Bank',
  currency: 'GBP', functionalCurrency: 'GBP',
  instrumentKind: 'loan',           // 'loan' | 'guarantee' | 'equity-fund' | 'equity-direct'

  // ----- Notional & dates -----
  faceValue: 25_000_000, purchasePrice: 25_000_000, commitment: 25_000_000,
  coveredAmount: 800_000_000,       // guarantee instruments only
  settlementDate: '2024-10-08',
  availabilityEnd: '2029-10-10',
  maturityDate: '2031-10-10',
  amortStart: '2024-10-08', amortEnd: '2031-10-10',

  // ----- Day-count conventions -----
  dayBasis: 'ACT/365',              // ACT/360 | ACT/365 | ACT/ACT | 30/360
  accrualDayCountExclusive: false,
  paydateDayCountInclusive: true,
  interestPreviousDay: false,
  businessDayConvention: 'modifiedFollowing',
  holidayCalendar: 'ukBank',        // 'none' | 'usFederal' | 'ukBank' | 'target'
  skipHolidays: false,
  accrualFreq: 'daily',             // 'daily' | 'biMonthly' | 'monthly'

  // ----- Coupon -----
  coupon: {
    type: 'SONIA',                  // 'Fixed' | 'Floating' | 'SONIA'
    fixedRate: 0,                   // for type='Fixed'
    floatingRate: 0,                // for type='Floating' — the index level
    spread: 0,                      // bps over the index, decimal
    floor: null, cap: null
  },
  rfr: { index: 'SONIA', baseRate: 0.0475, lookbackDays: 5, rounding: 5 },
  marginSchedule: [                 // date-effective margin steps (bps)
    { from: '2024-10-08', to: '2025-03-17', marginBps: 400 },
    { from: '2025-03-18', to: '2025-05-21', marginBps: 425 }
  ],
  esgAdjustment: { from: '2025-05-22', deltaBps: -2.5 },

  // ----- PIK -----
  pik: { enabled: false, rate: 0, capitalizationFrequency: 'Monthly' },

  // ----- Principal schedule (events) -----
  principalRepayment: 'AtMaturity',  // 'AtMaturity' | 'Scheduled'
  principalSchedule: [
    { date: '2026-04-01', type: 'draw',      amount: 25_000_000, status: 'actual', drawdownId: 'SP023' },
    { date: '2031-10-10', type: 'repayment', amount: 25_000_000 }
  ],

  // ----- Amortisation -----
  amortization: { method: 'effectiveInterestPrice' },  // 'none' | 'straightLine' | 'effectiveInterestPrice' | 'effectiveInterestFormula' | 'effectiveInterestIRR'

  // ----- Fees (multi) -----
  fees: [
    { id: 'arrangement', kind: 'arrangement', label: 'Arrangement Fee',
      mode: 'percent', rate: 0.0175, base: 'commitment',
      frequency: 'oneOff', paymentDate: '2024-10-13',
      ifrs: 'IFRS15-pointInTime' },
    { id: 'commitment', kind: 'commitment', label: 'Commitment Fee',
      mode: 'marginLinked', marginMultiple: 0.35, base: 'undrawn',
      frequency: 'quarterly', accrueFrom: '2024-10-08', accrueTo: '2029-10-10',
      ifrs: 'IFRS15-overTime',
      feeRateSchedule: [               // optional rate ratchet
        { from: '2024-10-08', to: '2030-12-31', rate: 0.0050 }
      ] }
  ],
  nonUseFee: { enabled: false, rate: 0 },

  // ----- IFRS 9 -----
  ifrs: {
    ifrs9Classification: 'AmortisedCost', // 'AmortisedCost' | 'FVOCI' | 'FVTPL'
    sppiPassed: true, businessModel: 'HoldToCollect',
    ecLStage: 1,                    // 1 / 2 / 3
    pdAnnual: 0.005, lgd: 0.40,
    computeECL: true                // default true if pdAnnual + lgd set
  },

  // ----- Multi-currency FX -----
  fxRateSchedule: [{ date: '2025-03-15', rate: 0.75 }],   // instrument ccy → functional

  // ----- Default events -----
  defaultEvents: [
    { date: '2027-06-15', kind: 'missedPayment', defaultRateBps: 200, defaultFeeAmount: 50_000, endDate: '2027-09-15', reason: 'Q2 covenant breach' }
  ],

  // ----- Modifications (IFRS 9 §5.4.3) -----
  modificationEvents: [
    { date: '2027-01-01', modType: 'non-substantial', gainLoss: -125_000, reason: 'Margin step extended', newCoupon: { /* forward terms */ } }
  ],

  // ----- Hedge accounting (IFRS 9 §6) -----
  hedge: {
    type: 'CFH', notional: 25_000_000, fixedRate: 0.05, floatingRate: 0.0475,
    effectivenessRatio: 0.95,
    fairValueSchedule: [{ date: '2024-10-08', mtm: 0 }],
    settlementDates: ['2026-06-30', '2027-06-30']
  },

  // ----- Multi-tranche / multi-underlying -----
  tranches: [ /* sub-instruments — see §9 */ ],
  underlyingLoans: [ /* guarantee multi-loan — see §9 */ ],

  // ----- Catalogue / preset -----
  type: 'simpleDaily',              // ID from TYPE_CATALOG
  preset: 'Display label'
}
```

For the full input schema, see `income-calculator-input.schema.md`.

---

## 6. Calculation logic

The engine walks the day grid from settlement → maturity. On each day, in order:

1. **Apply principal events** — initial / draw / paydown / repayment update `balance`, `drawnBalance`, `carryingValue`. `repayment` is an alias for `paydown` used by guarantee/equity-fund kinds.
2. **Modification events** — if today's date matches a `modificationEvents[]` entry, apply forward-looking term changes (newCoupon, newMaturity) and post the gain/loss.
3. **Resolve coupon rate** — Fixed: `fixedRate`. Floating: `floatingRate + spread` clamped to `[floor, cap]`. SONIA: `rfr.baseRate + (marginBps + esgBps)/10000` clamped.
4. **Day count factor** — based on `dayBasis`. Skip-on-holiday zeroes the factor.
5. **Amortisation window** — only accrete inside `[amortStart, amortEnd]`.
6. **Daily cash accrual** — `dailyCash = balance × couponRate × dcf` (suppressed for guarantee / equity kinds where NWF doesn't earn the underlying coupon).
7. **Daily PIK accrual** — `dailyPik = balance × pikRate × dcf` if `pik.enabled`.
8. **ECL provisioning** — target ECL based on stage; daily change posts to allowance.
9. **FX revaluation** — opening balance × (todayFX − yesterdayFX); flow events at today's rate.
10. **Hedge accounting** — daily MTM movement split by effectiveness; CFH effective to OCI, ineffective + FVH full to P&L.
11. **Non-use fee** — `(commitment − drawn) × rate × dcf` if `nonUseFee.enabled`.
12. **Multi-fee accrual** — for each fee in `fees[]`:
    - One-off + IFRS15-pointInTime → recognise full amount on `paymentDate`.
    - One-off + IFRS9-EIR → already in `deferredEIRPool` at t₀; emerges via daily EIR accretion.
    - Percent or marginLinked → `base × rate × dcf` (rate looked up from `feeRateSchedule` if present).
    - Flat (recurring) → `amount / lifeDays`.
13. **Default interest** — for active default events, `balance × defaultRateBps × dcf`. One-off `defaultFeeAmount` posts on event date.
14. **EIR accretion** — daily portion of `deferredEIRPool / lifeDays` accretes back to interest income, increasing carrying value.
15. **PIK capitalisation** — on capitalisation anchor dates, `cumPikAccrued` rolls into `balance`; pool resets.
16. **Discount/premium amortisation** — straight-line: `(face − price) / lifeDays`. Effective interest: `carryingValue × yield × dcf − dailyCash`.

Each row holds these numbers + the cumulative running totals. The summariser windows them by `[begin, end]` and computes period totals + per-fee breakdown + closing balances.

For the canonical formulas (with worked numerical examples), see `income-calculator-calc-logic.md`.

---

## 7. Fees · IFRS 9 / IFRS 15 treatment

Fees are first-class on every instrument. Each fee carries:

| Field | Values |
|---|---|
| `kind` | `arrangement` / `commitment` / `guarantee` / `other` — drives default GL accounts |
| `mode` | `percent` (rate × base × dcf), `flat` (amount), `marginLinked` (margin × marginMultiple × base × dcf) |
| `rate` | decimal (e.g., 0.0175 = 1.75%) — used in `percent` mode |
| `marginMultiple` | decimal (default 0.35 = 35% of margin) — used in `marginLinked` mode |
| `amount` | money — used in `flat` mode |
| `base` | `commitment` / `undrawn` / `drawn` / `covered` / `face` |
| `frequency` | `oneOff` / `daily` / `monthly` / `quarterly` / `semiAnnual` / `annual` |
| `paymentDate` | date for one-off fees, or first payment date |
| `accrueFrom` / `accrueTo` | ISO dates — defaults to settlement → maturity |
| `ifrs` | `IFRS9-EIR` / `IFRS15-overTime` / `IFRS15-pointInTime` |
| `feeRateSchedule` | optional `[{from, to, rate}]` rate ratchet |

**IFRS 9 EIR-included fees** (arrangement, OID, structuring) are pooled into `deferredEIRPool` at t₀ and accreted into interest income daily over the loan's life. JE pair: `DR 40100 Interest Income / CR 40110 Loan Carrying Value Contra`.

**IFRS 15 over-time fees** (commitment, guarantee, NWF commitment) accrue daily on the chosen base. JE pair: `DR 23150 Fee Receivable / CR 40250 Fee Income`.

**IFRS 15 point-in-time fees** (dividends, prepayment penalties, restructuring fees) recognise the full amount on `paymentDate`. Same GL pair as over-time but a single posting on the event date.

For deeper detail, see `fees-and-ifrs.md`.

---

## 8. Coupon · SONIA · margin ratchets · ESG

For SONIA-based instruments:
- `coupon.type = 'SONIA'`
- `rfr.baseRate` provides the SONIA base (illustrative — production should plug in actual fixings)
- `marginSchedule[]` — date-effective margin steps in bps (e.g., 400 → 425 → 450 → 525 over 7 years)
- `esgAdjustment` — single bps step from a given date (e.g., -2.5 bps from 22 May 2025)

Daily coupon = `rfr.baseRate + (marginBps + esgBps) / 10000`, clamped to `[floor, cap]`.

The "Active margin for commitment fee" requirement is met via `mode: 'marginLinked'` — the commitment fee dynamically tracks the margin × marginMultiple. This is the standard UK syndicated convention (e.g., commitment fee = 35% × margin).

---

## 9. Multi-tranche & multi-underlying-loan structures

A single instrument can hold either:

- **Tranches** (`tranches: [...]`) — for fixed + floating in one transaction. Each tranche has its own coupon, marginSchedule, principalSchedule, dayBasis, and fees. The engine builds a schedule per tranche and aggregates row-by-row (sums: balance, drawn, daily flows, fees; weighted-average coupon rates).
- **Underlying loans** (`underlyingLoans: [...]`) — for a guarantee covering multiple loans. Each underlying contributes to the aggregate covered-drawn balance against which the guarantee fee accrues.

Demonstrated by `Suffolk Solar Multi-Tranche` and `Volt Multi-Loan` in the seed dataset.

---

## 10. Default interest & default fees

```js
defaultEvents: [
  { date: '2027-06-15',
    defaultRateBps: 200,           // 2% penalty on top of contractual rate
    defaultFeeAmount: 50_000,      // one-off default fee
    endDate: '2027-09-15',         // optional — default ends here (else maturity)
    reason: 'Q2 covenant breach' }
]
```

GL pairs: `DR 23130 Default Interest Receivable / CR 40130 Default Interest Income` and `DR 23140 Default Fee Receivable / CR 40140 Default Fee Income`.

---

## 11. IFRS 9 ECL provisioning

Per IFRS 9 §5.5. Set `ifrs.pdAnnual`, `ifrs.lgd`, `ifrs.ecLStage` on the instrument:

- **Stage 1** — 12-month ECL = `EAD × pdAnnual × lgd`.
- **Stage 2** — Lifetime ECL = `EAD × min(1, pdAnnual × yearsRemaining) × lgd`.
- **Stage 3** — Lifetime ECL on net carrying (= gross less existing allowance), credit-impaired.

The engine accrues daily toward the target ECL and posts the change to allowance: `DR 70100 Impairment Expense / CR 15500 Loan Loss Allowance`. Releases (allowance going down on stage migration or paydown) reverse this.

---

## 12. Multi-currency FX revaluation

```js
currency: 'USD',
functionalCurrency: 'GBP',
fxRateSchedule: [
  { date: '2025-03-15', rate: 0.75 },   // USD → GBP (instrument-currency rate, not pair)
  { date: '2026-01-01', rate: 0.78 }
]
```

Daily FX gain = opening balance × (todayFX − yesterdayFX). Flows on the day are booked at today's FX. JE pair: `DR/CR 45000 FX Revaluation Gain or Loss / 15000 Loan Asset`.

The Schedule grid's `balanceFC` column shows the balance translated to functional currency.

---

## 13. IFRS 9 modification accounting

Per IFRS 9 §5.4.3:

```js
modificationEvents: [
  { date: '2027-01-01',
    modType: 'non-substantial',          // or 'substantial'
    gainLoss: -125_000,                  // negative = loss to P&L
    reason: 'Margin step extended',
    newCoupon: { fixedRate: 0.0875 },    // optional forward-looking term changes
    newMaturity: '2032-10-10' }
]
```

Substantial modifications (≥10% PV change) should derecognise the old instrument and recognise a new one — the engine applies new terms forward and emits a P&L adjustment; for full derecognition you can split into two instruments via the wizard. Non-substantial mods adjust the carrying value and post the difference to P&L. JE pair: `DR/CR 44000 Modification Gain/Loss / 15000 Loan Asset`.

---

## 14. IFRS 9 hedge accounting

Per IFRS 9 §6 — Cash Flow Hedge (CFH) or Fair Value Hedge (FVH).

### UI controls (Setup tab → Hedge Accounting card)

| Control | Purpose |
|---|---|
| Hedge Type | `None` (no hedge — clears the hedge block), `CFH`, or `FVH` |
| Notional | Hedging instrument notional in instrument currency |
| Fixed Leg Rate | The pay-fixed leg's rate (decimal, e.g., `0.05` = 5%) |
| Floating Leg Rate | The receive-floating leg's rate at inception (decimal) |
| Effectiveness Ratio | Effective portion fraction (e.g., `0.95` = 95%); the engine bisects daily MTM moves by this ratio |
| **Fair Value Schedule** table | Editable rows of `(Date, MTM)` — the hand-fed hedge fair value at each observation date. **+ Add MTM step** creates a new row 90 days after the last. Delete via the trash icon per row. |
| **Settlement Dates** table | Editable list of dates (CFH only). On each, the accumulated hedge reserve is reclassified to P&L. **+ Add settlement date** creates a new row 90 days after the last. |

Every input fires a recalculation immediately — change any field and the schedule grid, KPIs, and DIU export refresh. Edits to user-created instruments auto-save to localStorage.

### Data model

```js
hedge: {
  type: 'CFH',                    // 'CFH' | 'FVH'
  notional: 25_000_000,
  fixedRate: 0.05, floatingRate: 0.0475,
  effectivenessRatio: 0.95,       // 80%-125% range under IAS 39 numerical test (kept as diagnostic)
  fairValueSchedule: [            // hand-fed MTM (or computed externally — front-office system feed)
    { date: '2024-10-08', mtm: 0 },
    { date: '2025-06-30', mtm: 250_000 },
    { date: '2026-06-30', mtm: 600_000 }
  ],
  settlementDates: ['2026-06-30', '2027-06-30']  // CFH only
}
```

### Engine logic

Daily MTM movement (today − yesterday):
- **CFH** → effective portion = `dMTM × effectivenessRatio` accumulated in `cashFlowHedgeReserve` (OCI). Ineffective = `dMTM × (1 − effectivenessRatio)` to P&L.
- **FVH** → full `dMTM` to P&L (offsetting the hedged item's FV change).

Reclassification on settlement dates drains the hedge reserve into P&L (matches the hedged cashflow as it materialises).

### JE pairs emitted

- OCI movement (CFH): `DR/CR 16000 Hedging Instrument / 35000 Cash Flow Hedge Reserve (OCI)`
- P&L: `DR/CR 16000 Hedging Instrument / 45100 Hedge Ineffectiveness P&L` (CFH) or `45200 FV Hedge P&L` (FVH)
- Reclass: `DR 35000 Cash Flow Hedge Reserve / CR 45100 Hedge Income (Reclass from OCI)`

### Worked example — Libra 3

The seed dataset includes **Libra 3** as the canonical hedge-accounting demonstration. It is structurally identical to Libra 2 (same £25M GBP SONIA + ratcheted margin loan, same fees, same IFRS 9 stage 1 ECL) plus a 95%-effective Cash Flow Hedge: pay-fixed (5%) receive-floating (SONIA) IRS with hand-fed fair values from inception (£0) up to £850K in 2027 then back down to £0 at maturity. 14 quarterly settlement dates aligned to interest periods drain the OCI reserve to P&L over the loan's life.

For the 2026 period, Libra 3 produces:

| Line | Amount |
|---|---:|
| Hedging Instrument MTM (CFH OCI) | £332,500 (DR 16000) |
| Cash Flow Hedge Reserve (OCI) | £332,500 (CR 35000) |
| Hedging Instrument MTM | £17,500 (DR 16000) |
| Hedge Ineffectiveness P&L | £17,500 (CR 45100) |
| Cash Flow Hedge Reserve Reclass | £332,500 (DR 35000) |
| Hedge Income (Reclass from OCI) | £332,500 (CR 45100) |

**Libra 2 deliberately has NO hedge block** so it remains a faithful match of the requirements XLSX. To compare like-for-like, pick Libra 2 first to see the pure loan economics, then switch to Libra 3 to see the same loan with hedge accounting layered on. The only diff is the hedge.

---

## 15. Cash flow forecast & maturity ladder

Surfaced on the **Summary tab**. Edit the As-of date and the engine projects all flows from that date forward into IFRS 7 buckets:

| Bucket | Definition |
|---|---|
| ≤30d | 0 to 30 days from as-of |
| 31-90d | 31 to 90 days |
| 91-180d | 91 to 180 days |
| 181d-1yr | 181 to 365 days |
| 1-5yr | 1 to 5 years |
| >5yr | beyond 5 years |

Each bucket sums Principal + Interest + Fees + EIR Accretion + Default Interest. The stacked-bar visualisation shows the composition per bucket.

---

## 16. DIU export

The DIU tab shows every general-ledger posting the engine produced for the active period, in FIS Investran Data Import Utility format. Click **Download DIU CSV** to export.

The export includes (where applicable for the instrument):
- Interest receivable / income pair
- PIK capitalisation pair
- Discount/premium accretion pair
- Non-use fee pair
- Per-fee IFRS 15 pairs (Arrangement, Commitment, Guarantee, NWF Commitment, Management Fee, etc.)
- IFRS 9 EIR fee accretion pair
- Default interest + default fee pairs
- ECL provisioning pair (build-up or reversal)
- FX revaluation pair (gain or loss)
- Modification gain/loss pair
- Hedge accounting pairs (OCI movement, P&L, settlement reclass)
- **Cash-leg JEs** — drawdowns, repayments, and cash-settlement of every accrued receivable on payment dates

---

## 17. Investran adapters

Two Python scripts (in `scripts/`) connect to FIS Investran:

- **`investran_inbound.py`** — pulls Reference Data v2 (LE → Deal → Position → Security) and emits per-security JSON files in the calculator's exact import shape. Run with `--le-id <GUID>` for a single LE or `--all-les` for a full pull. Outputs go to `data/instruments/<id>.json` plus a bundle `data/instruments-from-investran.json`.
- **`investran_outbound.py`** — POSTs the calculator's DIU output to `/api/DataImport/v1/batches` as a multipart upload. Computes a deterministic `externalKey` (sha256 of instrumentId + period + rows) so retries are idempotent. Polls batch status to terminal state.

Required env vars: `INVESTRAN_BASE_URL` (default `https://investranweb-livedev-us.fiscloudservices.com`) and `INVESTRAN_TOKEN`.

The browser-only calculator can't directly hit the API (auth/CORS) but accepts paste-JSON via the **Refresh from Investran** button on the Add-Instrument modal — the inbound adapter's output drops in cleanly.

For setup, field maps, error handling, and idempotency rules, see `investran-interfaces.md`.

---

## 18. Worked examples

Thirteen seed instruments demonstrate the full surface:

| Instrument | LE | What it shows |
|---|---|---|
| **Alliance Manufacturing Convertible Note** | FCP-I | PIK note, fixed coupon + 14% PIK on top, monthly capitalisation |
| **Copperleaf 8% 2030 Sr Notes** | FCP-I | Discount bond at 92.5% of par, effective interest accretion |
| **Orion Term Loan B (FCP-II £40m)** | FCP-II | Floating SOFR + 575 with floor/cap, scheduled paydowns, straight-line amort |
| **Orion Term Loan B (FCP-I £20m secondary)** | FCP-I | Same security as FCP-II's holding — multi-LE syndicate at different cost basis |
| **Northwind RCF** | FCO-III | Revolver with non-use fee on undrawn, draw / paydown / draw sequence |
| **Meridian Unitranche** | DL-IV | SOFR + 600 PIK toggle, 1% OID accreted, scheduled amort |
| **Libra 2 (HSBC Facility B4)** | NWF Sustainable Infrastructure | SONIA + ratcheted margin, ESG -2.5 bps, 1.75% arrangement (IFRS 15 PIT), 35% × margin commitment fee (IFRS 15 OT). **No hedge — matches the requirements XLSX exactly.** |
| **Libra 3 (HSBC Facility B4 + CFH)** | NWF Sustainable Infrastructure | Same structure as Libra 2 plus a 95%-effective Cash Flow Hedge IRS. The canonical IFRS 9 §6 hedge-accounting example. |
| **Volt Financial Guarantee** | NWF Sustainable Infrastructure | £1bn underlying with £800m covered, 0.5% guarantee fee on drawn covered, 35% × guarantee fee NWF commitment fee |
| **Volt Multi-Loan Guarantee** | NWF Sustainable Infrastructure | Single guarantee covering 2 underlying loans (SONIA + Fixed) with fee-rate ratchet 0.5% → 0.6% from 2031 |
| **Suffolk Solar Multi-Tranche** | NWF Sustainable Infrastructure | Single facility split into £50m Fixed 6.5% + £50m SONIA + 350 (different day bases) |
| **XYZ Buyout Fund LP** | NWF Renewable Equity | FVTPL equity, 1.75% mgmt fee on commitment Y1-5, 1.25% on invested cost Y5+ |
| **ABCDEF Series C** | NWF Renewable Equity | Direct FVTPL equity, point-in-time dividend recognition Y2 / Y3 / Y5 |

---

## 19. Common scenarios

### "I want to add a new bilateral SONIA loan"
1. + Add New Instrument
2. Pick LE, type Deal name, type Position name and Security name
3. Set Currency = GBP, Day Basis = ACT/365, Coupon Type = SONIA, Face = £25M
4. Save
5. On the Setup tab, expand **SONIA / RFR · Margin Ratchet** → set base SONIA, lookback, ESG, and add margin steps with date-from/date-to/bps
6. On the Setup tab, expand **Fees · IFRS 9 / 15 Treatment** → click + Add fee, set kind=arrangement, mode=percent, rate=0.0175, base=commitment, frequency=oneOff, paymentDate, IFRS=IFRS15-pointInTime
7. Add another fee for commitment: kind=commitment, mode=marginLinked, marginMultiple=0.35, base=undrawn, frequency=quarterly, IFRS=IFRS15-overTime

### "I want to add a guarantee covering multiple underlying loans"
1. Add a new instrument with `instrumentKind = 'guarantee'`
2. In the JSON-import modal, paste an instrument with `underlyingLoans: [{...}, {...}]` populated — see Volt Multi-Loan as a template

### "I want to model a fixed + floating tranche structure"
Same as above but use `tranches: [...]` instead of `underlyingLoans`.

### "I want to apply an ECL provision"
On the Setup tab, scroll to **Fees · IFRS 9 / 15** card → fill in IFRS 9 Classification, ECL Stage, PD, LGD. The engine begins accruing the ECL allowance immediately and posting JE pairs.

### "I want to revalue a USD loan held by a GBP fund"
Edit the instrument JSON to add `functionalCurrency: 'GBP'` and `fxRateSchedule: [{date, rate}, ...]`. The Schedule grid's balance column will show in instrument currency; check the Summary tab for FX gain.

### "I want to model a hedge"
Easiest path: open the **Hedge Accounting** card on the Setup tab. Pick `CFH` or `FVH` from the Hedge Type dropdown, fill in notional / fixed leg / floating leg / effectiveness ratio, then build the Fair Value Schedule (one row per observation — date + MTM in instrument currency) and, for CFH, the Settlement Dates list. Use the **+ Add MTM step** and **+ Add settlement date** buttons to grow each table; trash icons remove rows. Every change recalculates instantly and the new hedge JE pairs flow through to the DIU export.

For a worked example to copy from, switch to **Libra 3** in the picker — it's a clone of Libra 2 with a complete CFH already wired up (9 MTM observations, 14 settlement dates, 95% effectiveness ratio). Compare side-by-side against Libra 2 (no hedge) to see exactly what the hedge accounting adds.

If you'd rather edit JSON directly, the data model is:

```js
hedge: {
  type: 'CFH',                     // or 'FVH'
  notional: 25_000_000,
  fixedRate: 0.05, floatingRate: 0.0475,
  effectivenessRatio: 0.95,
  fairValueSchedule: [{ date: '2024-10-08', mtm: 0 }, ...],
  settlementDates: ['2026-06-30', '2027-06-30', ...]
}
```

### "I want to record a covenant breach with default interest from a date forward"
Add to `defaultEvents`: `{ date, defaultRateBps: 200, defaultFeeAmount: 50_000, endDate, reason }`. Default accrual continues until `endDate` (or maturity).

### "I want to test a margin re-pricing mid-life"
Add to `modificationEvents`: `{ date, modType: 'non-substantial', gainLoss: -X, newCoupon: {...} }`. Forward terms apply from that date.

### "I want to project cash flow over the next 12 months"
Open the Summary tab → set the **As-of** date in the Cash Flow Forecast card to today. The bucketed table updates instantly.

### "I want to see only event days in the schedule"
Schedule tab → **Show rows** dropdown → "Event days & rate changes". The view collapses thousands of daily rows to ~10-30 meaningful ones (drawdowns, repayments, capitalisations, margin steps, ESG transitions, fee payments, default events).

### "I want to refresh my LE list from Investran"
Run `python scripts/investran_inbound.py --all-les --les-only` (output is JSON), copy the result, click **+ Add New Instrument** in the calculator, then **From Investran** button, paste the JSON. The LE dropdown updates immediately and persists to localStorage.

---

## 20. Reconciling against external software

When a number doesn't tie to your reference system, the most common causes are:

1. **Day-count convention boundary** — toggle `Accrual Day Count Exclusive` to use 92 days vs 93 days for a quarterly window.
2. **Margin / fee rate interpretation** — UK syndicated loans treat "0.35" as 35% of margin (`mode: 'marginLinked'`), not 0.35% literal.
3. **ESG bps magnitude** — verify whether the documented "2.5 bps" is actually 25 bps in the source system.
4. **Drawdown profile** — reference systems often book a single tranche on the first interest period start; the requirements sheet may have multiple sub-tranches.
5. **Day basis** — ACT/360 vs ACT/365 vs 30/360 changes interest by ~1.4%.
6. **IFRS 9 vs IFRS 15 fee classification** — arrangement fee point-in-time vs deferred makes a £437,500 difference at recognition.
7. **SONIA fixings** — calculator uses a single base rate; reference uses time-varying fixings.

For a worked example reconciliation against an external SP023 ledger, see `reconciliation-vs-reference.md`.

---

## 21. Persistence & data safety

- User-created instruments are stored in `localStorage` under `pe-loan-calc.user-instruments.v1`.
- Cached Investran LEs are stored under `pe-loan-calc.investran-les.v1`.
- **No data leaves your machine** — the calculator is fully client-side. The Investran adapters run in Python from your terminal; you control the API tokens.
- Clearing browser data wipes user instruments — back them up via the JSON export modal first.
- Seed instruments are hardcoded in the file and can't be deleted via the UI.

---

## 22. Glossary of GL accounts

| Account | Description |
|---|---|
| 10000 | Cash |
| 15000 | Loan Asset (carrying value) |
| 15500 | Loan Loss Allowance (contra-asset, IFRS 9 ECL) |
| 16000 | Hedging Instrument (IRS / cap / collar fair value) |
| 23000 | Interest Receivable |
| 23100 | Non-Use Fee Receivable |
| 23130 | Default Interest Receivable |
| 23140 | Default Fee Receivable |
| 23150 | Fee Receivable (IFRS 15 — arrangement / commitment / guarantee / mgmt / dividend) |
| 35000 | Cash Flow Hedge Reserve (OCI, IFRS 9 §6.5.11) |
| 40100 | Interest Income |
| 40110 | Loan Carrying Value Contra (EIR offset) |
| 40130 | Default Interest Income |
| 40140 | Default Fee Income |
| 40150 | Discount Accretion / Premium Amortisation / PIK Capitalisation |
| 40200 | Non-Use Fee Income |
| 40250 | Fee Income (IFRS 15) |
| 44000 | Modification Gain/Loss (IFRS 9 §5.4.3) |
| 45000 | FX Revaluation Gain/Loss |
| 45100 | Hedge Ineffectiveness P&L / Reclassification from OCI |
| 45200 | Fair Value Hedge P&L |
| 70100 | Impairment Expense (IFRS 9 ECL) |

Adjust per tenant chart-of-accounts as needed (the DIU export carries the labels and codes through to your downstream system).

---

## Related documents

- `income-calculator-input.schema.md` — full instrument JSON schema
- `income-calculator-output.schema.md` — full output JSON schema (period summary + DIU + EIR analytics)
- `income-calculator-calc-logic.md` — formula derivations with worked numbers
- `fees-and-ifrs.md` — fees and IFRS 9 / 15 treatment deep dive
- `investran-interfaces.md` — inbound / outbound adapter operator guide
- `scenarios-coverage.md` — what's covered against the requirements XLSX scenarios
- `reconciliation-vs-reference.md` — worked reconciliation against external SP023 ledger

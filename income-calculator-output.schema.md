# Income Calculator — Output Payload Reference

The engine's `calculate(input)` returns a JSON object. This document describes every field.

## Top-Level Shape

```json
{
  "ok": true,
  "meta": { ... },
  "summary": { ... },
  "periodRows": [ ... ],
  "schedule":   [ ... ],
  "journalEntries": [ ... ]
}
```

If input validation fails, the response collapses to:

```json
{
  "ok": false,
  "errors": ["Missing period.end", "Missing \"instrument\"", ...]
}
```

---

## 1. `meta`

Diagnostic and audit information about the run.

| Field               | Type    | Description |
|---------------------|---------|-------------|
| `generatedAt`       | ISO datetime | When the calculation ran (UTC). |
| `engineVersion`     | string  | Engine semver. |
| `instrumentId`      | string  | Echoed from `input.instrument.id`. |
| `instrumentType`    | string  | Echoed from `input.instrument.type` (template id). |
| `period.begin`      | ISO date | Echoed. |
| `period.end`        | ISO date | Echoed. |
| `period.last`       | ISO date | Echoed. |
| `effectiveYield`    | number or null | The yield `y` actually used for the effective-interest family (per year, decimal). `null` when amortization method is `none` or `straightLine`. |
| `amortizationMethod`| enum    | `"none"`, `"straightLine"`, `"effectiveInterestPrice"`, `"effectiveInterestFormula"`, `"effectiveInterestIRR"`. |
| `dayBasis`          | enum    | `"ACT/360"`, `"ACT/365"`, `"ACT/ACT"`, `"30/360"`. |

---

## 2. `summary`

Period totals — derived from the subset of daily rows inside `[period.begin, period.end]`.

| Field              | Type    | Description |
|--------------------|---------|-------------|
| `periodStart`      | ISO date | First day in the window (may differ from `period.begin` if settlement is later). |
| `periodEnd`        | ISO date | Last day in the window (may differ from `period.end` if maturity is earlier). |
| `daysCount`        | integer | Number of daily rows in the window. |
| `openingBalance`   | number  | Principal balance at the start of the first day in the window. |
| `closingBalance`   | number  | Principal balance at the end of the last day (includes PIK capitalizations within the period). |
| `closingCarrying`  | number  | Book (carrying) value at the end of the last day. |
| `totalCashAccrual` | number  | Σ `dailyCash` over the window. Cash interest income. |
| `totalPikAccrual`  | number  | Σ `dailyPik` over the window. PIK interest earned (not yet capitalized). |
| `totalCapitalized` | number  | Σ `capitalized` over the window. PIK rolled into principal. |
| `totalAmort`       | number  | Σ `amortDaily` over the window. **Signed**: positive = discount accretion, negative = premium amortization. |
| `totalNonUseFee`   | number  | Σ `nonUseFee` over the window. Non-use fee income on undrawn commitment. |

---

## 3. `periodRows` and `schedule`

Both are arrays of daily row objects with identical shape. The difference:

- **`schedule`** — every day from `instrument.settlementDate` through `instrument.maturityDate`. Useful for full-life reporting.
- **`periodRows`** — only the rows inside `[period.begin, period.end]`. Useful for period-level drill-down.

Each row:

| Field                | Type    | Description |
|----------------------|---------|-------------|
| `date`               | ISO date | The day. |
| `dayOfWeek`          | integer | 0=Sunday, 6=Saturday. |
| `balance`            | number  | Principal balance at end of day (after events + PIK capitalization). |
| `drawnBalance`       | number  | Drawn portion of a revolver (excludes PIK capitalizations). |
| `carryingValue`      | number  | Book value after discount/premium amortization. |
| `initialPurchase`    | number  | The `initial` event amount posted on `settlementDate`, else 0. |
| `draw`               | number  | Draw amount posted today (revolver draws or add-ons). |
| `paydown`            | number  | Paydown amount posted today. |
| `couponRate`         | number  | Effective coupon rate applied today (decimal). |
| `floatingRate`       | number  | Raw index rate (before spread/cap/floor). `0` for Fixed coupons. |
| `dailyCash`          | number  | Cash interest accrued today = `balance × couponRate × dcf`. |
| `cumInterestAccrued` | number  | Running sum of `dailyCash` from settlement through today. |
| `cumInterestEarned`  | number  | Same as `cumInterestAccrued`. Reserved for future divergence (e.g., accrual vs. paid tracking). |
| `capitalized`        | number  | PIK amount rolled into principal today. `0` on non-capitalization days. |
| `pikRate`            | number  | PIK rate (decimal). `0` when PIK disabled. |
| `dailyPik`           | number  | PIK accrued today = `balance × pikRate × dcf`. |
| `cumPikAccrued`      | number  | PIK pool since the last capitalization. Resets to 0 on capitalization days. |
| `cumPikEarned`       | number  | Lifetime PIK earned (never reset). |
| `amortDaily`         | number  | Discount/premium amortized today. Signed (see summary). |
| `cumAmort`           | number  | Running signed sum of `amortDaily`. |
| `nonUseFee`          | number  | Non-use fee accrued today. |
| `cumNonUseFee`       | number  | Running sum of `nonUseFee`. |
| `onHoliday`          | boolean | `true` if today falls on a day in the selected `holidayCalendar`. |
| `skipped`            | boolean | `true` if `skipHolidays=true` AND today is a holiday. When `true`, `dcf` was forced to 0 and none of `dailyCash/dailyPik/nonUseFee` accrued. |
| `hasEvent`           | boolean | `true` if today had a principal event OR a PIK capitalization. Useful for filtering the schedule to "interesting" days. |

---

## 4. `journalEntries`

Debit/credit pairs representing the period's accounting impact. Each pair is emitted only when the underlying total is non-zero (with a `0.005` dead-zone on amortization and non-use fee lines to suppress rounding noise).

| Trigger                  | Debit Entry                         | Credit Entry              |
|--------------------------|-------------------------------------|---------------------------|
| `totalCashAccrual != 0`  | Income - Daily Accrued Interest (23000) | Interest Receivable (40100) |
| `totalCapitalized != 0`  | PIK Investment (40100)              | Interest Receivable (23000) *(both posted with negative `originalAmount` for reclass)* |
| `|totalAmort| > 0.005`   | Accretion/Amort Offset (23000)      | Discount Accretion / Premium Amortization (40150) |
| `totalNonUseFee > 0.005` | Non-Use Fee Receivable (23100)      | Non-Use Fee Income (40200) |

Each entry:

| Field                  | Type     | Description |
|------------------------|----------|-------------|
| `legalEntity`, `leid`  | string/int | Copied from instrument. |
| `batchId`              | int      | Always `1` for a single-run batch. |
| `jeIndex`              | int      | Groups a debit/credit pair (`1` for interest, `2` for PIK, ...). |
| `txIndex`              | int      | Order within the pair: `1` = credit side, `2` = debit side. |
| `glDate`               | ISO date | The period end date (GL posting date). |
| `effectiveDate`        | ISO date | Same as `glDate` in the current engine. |
| `deal`, `position`, `incomeSecurity` | string | Copied from instrument. |
| `transactionType`      | string   | Descriptive label ("Interest Receivable", "PIK Investment", etc.). |
| `account`              | string   | GL account code. |
| `allocationRule`       | string   | `"By Commitment and GL Date"` (credit side) or `"Non-Dominant"` (debit side). |
| `batchType`            | string   | Always `"Loan Calculator"`. |
| `batchComments`        | string   | `"Loan Calculator Entries from {periodStart} to {periodEnd}"`. |
| `transactionComments`  | string   | Per-entry narrative. |
| `originalAmount`       | number   | Signed amount (negative for PIK reclass pairs). |
| `amountLE`             | number   | `abs(originalAmount)` — legal-entity currency. |
| `fx`                   | number   | FX rate to local. Always `1` in the current engine. |
| `amountLocal`          | number   | `amountLE × fx`. |
| `isDebit`              | boolean  | `true` for the debit side, `false` for the credit side. |
| `leDomain`             | string   | Always `"Investran Global"`. |

---

## 5. Numeric Precision

All numbers in the output are rounded to 6 decimal places (`Math.round(v * 1e6) / 1e6`). Display-layer rounding is independent — the HTML UI formats money to 2 dp and rates to 4 dp at render time.

Aggregate totals in `summary` are computed by summing the raw (unrounded) daily values, then rounded once at serialization time. This is deliberate: summing the rounded rows would drift by sub-cent amounts over a multi-year instrument.

---

## 6. Example — Truncated Alliance Output

```json
{
  "ok": true,
  "meta": {
    "generatedAt": "2026-04-23T12:30:28.674Z",
    "engineVersion": "1.0.0",
    "instrumentId": "alliance",
    "instrumentType": "pikNoteFixed",
    "period": { "begin": "2020-01-01", "end": "2020-03-05", "last": "2019-12-31" },
    "effectiveYield": null,
    "amortizationMethod": "none",
    "dayBasis": "ACT/360"
  },
  "summary": {
    "periodStart": "2020-01-01",
    "periodEnd":   "2020-03-05",
    "daysCount": 65,
    "openingBalance":  28456806.596135,
    "closingBalance":  29147067.63223,
    "closingCarrying": 29147067.63223,
    "totalCashAccrual": 624480.776478,
    "totalPikAccrual":  728560.905891,
    "totalCapitalized": 690261.036095,
    "totalAmort":       0,
    "totalNonUseFee":   0
  },
  "periodRows": [
    { "date": "2020-01-01", "balance": 28456806.596135, "dailyCash": 9485.60, ... },
    { "date": "2020-01-02", "balance": 28456806.596135, "dailyCash": 9485.60, ... },
    "..."
  ],
  "schedule":       [ "..." ],
  "journalEntries": [ "..." ]
}
```

See `income-calculator-sample-output.json` for the full, un-truncated result of running the engine on `income-calculator-input.sample.json`.

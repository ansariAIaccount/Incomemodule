# Income Calculator — Calculation Logic Reference

This document specifies every calculation the engine performs to produce a period's accrual schedule and journal entries. It is organized in the order the engine executes, so it doubles as a walkthrough of `buildSchedule()`.

All monetary amounts are in instrument currency (USD in the demo). All rates are annual decimals (e.g. `0.12` = 12%). Dates are ISO `YYYY-MM-DD`.

---

## 1. Execution Overview

Given an `instrument` and an accrual `period`, the engine:

1. Builds a day-by-day schedule from `settlementDate` to `maturityDate` (full life of the instrument, not just the period).
2. On each day, in this order:
   1. Apply any principal events (initial, draw, paydown).
   2. Resolve today's coupon rate (fixed or floating with caps/floors).
   3. Decide if today is skipped (holiday + `skipHolidays`).
   4. Compute the day-count factor (`dcf`).
   5. Accrue daily cash interest.
   6. Accrue daily PIK interest (if enabled).
   7. Accrue daily non-use fee (if enabled).
   8. Capitalize PIK (if today is an anchor day).
   9. Amortize discount/premium (if inside the amort window).
   10. Emit the day row.
3. Filter rows to `[period.begin, period.end]` and roll up totals.
4. Emit journal entries ("DIU") from the totals.

---

## 2. Day Grid

```
days = eachDay(settlementDate, maturityDate)       // inclusive on both ends
```

Day objects are anchored at noon local time to avoid DST drift near midnight (`setHours(12,0,0,0)`). This matters for calendars crossing daylight-saving boundaries.

The engine always walks the full life of the instrument. The accrual `period` is a *view* over the fully-populated row set.

---

## 3. Day-Count Factor (`dcf`)

The per-day fraction of a year attributable to the current date.

| `dayBasis` | `dcf(d)` | Notes |
|------------|----------|-------|
| `ACT/360`  | `1 / 360`         | Market standard for USD loans and SOFR-indexed floaters. |
| `ACT/365`  | `1 / 365`         | Common for GBP and AUD. Ignores leap years. |
| `ACT/ACT`  | `1 / 365` or `1 / 366` | Uses `isLeap(date.year)` for the actual year. |
| `30/360`   | `1 / 360`         | Simplified to per-day `1/360` (30/360 is only observable over whole months, so at daily granularity it's equivalent to ACT/360 in aggregate). |

Holiday override: if `skipHolidays` is `true` and today is in the selected `holidayCalendar`, the engine sets `dcf = 0` (no accrual on that date).

---

## 4. Coupon Rate Resolution

Today's applied rate `couponRate` is computed per-day.

**Fixed coupon**

```
couponRate = coupon.fixedRate
```

**Floating coupon**

```
r = floatingRate + spread
if floor != null: r = max(r, floor)
if cap   != null: r = min(r, cap)
couponRate = r
```

Floor and cap are applied in that order (floor first, then cap). A null floor or cap disables that side of the collar.

`floatingRate` is stored on the instrument as a single "current" index rate. The demo does not compute forward resets — in production this slot would be replaced with a day-indexed curve of reset values.

---

## 5. Daily Cash Accrual

For each day `d`:

```
dailyCash(d) = balance(d) × couponRate(d) × dcf(d)
```

Where `balance(d)` is the principal balance at the start of the day (after applying that day's events). The running total across the period is the period's cash-interest income.

**Accrual-day flags**

- `accrualDayCountExclusive = true` → start day excluded. This shifts the day grid by one; for a vanilla loan the engine achieves this by including the start day with `dcf = 0` accrual.
- `paydateDayCountInclusive = true` → end day included (the engine's default). Set `false` to drop the last day.

These flags are stored and surfaced in the UI; the core engine walks a fully inclusive grid and the flags drive downstream reporting rather than modifying `dcf` directly in the current build.

---

## 6. PIK Accrual and Capitalization

PIK ("payment-in-kind") interest is tracked on a separate pool (`cumPikAccrued`) and periodically rolled into principal.

**Daily PIK accrual** (only if `pik.enabled`):

```
dailyPik(d) = balance(d) × pik.rate × dcf(d)
cumPikAccrued += dailyPik(d)
```

**Capitalization gate** — `isCapitalizationDay(d, anchor, freq)` returns `true` when:

```
d.day-of-month == anchor.day-of-month   (anchor = settlementDate)
AND months-elapsed mod N == 0
  where N = 1  (Monthly)
        3  (Quarterly)
        12 (Yearly)
AND months-elapsed > 0
```

On a capitalization day:

```
capitalized    = cumPikAccrued
balance       += capitalized
carryingValue += capitalized      // keeps carrying value in step for EIR
cumPikAccrued  = 0                // drain the pool
```

The PIK rate then compounds, because the next day's `dailyPik` is computed on the higher `balance`. This is the intended behavior: PIK interest earns interest after each capitalization tick.

---

## 7. Non-Use (Commitment) Fee

Charged on the undrawn portion of a revolver.

```
undrawn       = max(0, commitment - drawnBalance)
dailyNonUse   = undrawn × nonUseFee.rate × dcf(d)   if nonUseFee.enabled
```

`drawnBalance` is tracked alongside `balance` on a revolver. The distinction matters because PIK capitalizations grow `balance` but not `drawnBalance` — the non-use fee is computed against the legal drawn amount, not PIK-grossed-up principal.

Typical rate is 25–50 bps annualized.

---

## 8. Principal Events

The `principalSchedule` is sorted by `date` ascending. On each day the engine applies every event dated on that day.

| `type`    | Effect on `balance` | Effect on `drawnBalance` | Effect on `carryingValue` |
|-----------|---------------------|--------------------------|---------------------------|
| `initial` | no-op (already counted into the starting balance) | no-op | no-op |
| `draw`    | `+= amount` | `+= amount` | `+= amount` |
| `paydown` | `-= amount` | `-= amount` | `-= amount` |

**Starting balance** is computed as:

```
if there's an event at settlementDate with type 'initial' or 'draw':
   balance = that event's amount
else:
   balance = faceValue
drawnBalance  = balance
carryingValue = purchasePrice ?? faceValue
```

---

## 9. Amortization of Discount / Premium

Applied only when the current date is inside the amort window:

```
amortStart      = instrument.amortStart ?? settlementDate
amortEnd        = instrument.amortEnd   ?? maturityDate
inAmortWindow   = amortStart <= d <= amortEnd
```

Five methods are supported. Only one runs per instrument (mutually exclusive).

### 9.1 `none`

```
dailyAmort = 0
```

Par bond or no discount/premium to recognize.

### 9.2 `straightLine`

```
totalDays         = (maturity - settlement) in days
straightLineDaily = (faceValue - purchasePrice) / totalDays
dailyAmort        = straightLineDaily           // constant across life
carryingValue    += dailyAmort
```

- Discount bond (`purchasePrice < faceValue`): `dailyAmort > 0` → carrying value drifts upward toward face; period totals post as **discount accretion** income.
- Premium bond (`purchasePrice > faceValue`): `dailyAmort < 0` → carrying value drifts downward; period totals post as **premium amortization** (offset to income).

### 9.3 `effectiveInterestPrice` — solve yield from purchase price

Two-stage solver.

**Stage 1: seed via bisection.** Build a simplified set of annual cash flows:

```
yearsToMat = totalDays / daysPerYear   (360 or 365 per basis)
cashflows  = [ {t=1, amount=coupon}, {t=2, amount=coupon}, ..., {t=yearsToMat, amount=coupon×stub + face} ]
  where coupon = faceValue × coupon.fixedRate
        stub   = yearsToMat - floor(yearsToMat)
```

Bisect on `y ∈ [-0.99, 5.0]` until `NPV(y, cashflows) == purchasePrice`:

```
NPV(y, cfs) = Σ amount / (1 + y)^t
```

The bisection runs ≤ 200 iterations; converges when `|f(mid)| < 1e-9`.

**Stage 2: secant refinement against the daily schedule.** Define:

```
runCarrying(y):
   cv = purchasePrice
   for day k = 0 .. totalDays:
      cv += cv × y × (1/daysPerYear)  −  faceValue × couponRate × (1/daysPerYear)
   return cv
```

Target: `runCarrying(y) == faceValue` (carrying value lands exactly at face on maturity day).

Up to 6 secant iterations starting from `y0 = seed` and `y1 = 1.001 × seed`. Terminates when `|f(y1)| < 1e-3` (one-tenth of a cent).

Once `y = effectiveYield` is fixed, daily amortization follows the EIR rule:

```
dyield          = effectiveYield × dcf(d)
effectiveIncome = carryingValue × dyield
dailyAmort      = effectiveIncome - dailyCash      // income NOT covered by cash coupon
carryingValue  += dailyAmort
```

### 9.4 `effectiveInterestFormula` — yield from formula

```
effectiveYield = coupon.fixedRate + amortization.spread
```

Then apply the same EIR daily formula as 9.3. Useful for variable instruments where yield is an additive spread over the coupon rate.

### 9.5 `effectiveInterestIRR` — explicit yield override

```
effectiveYield = amortization.yieldOverride (falls back to coupon.fixedRate if null)
```

Then apply the same EIR daily formula. Used when yield is computed externally (e.g. by a separate TWR or waterfall engine).

**Sign convention** (applies to all three effective-interest methods):

- `dailyAmort > 0`: yield exceeds cash coupon → discount is being accreted into carrying value → posts as **discount accretion** income.
- `dailyAmort < 0`: cash coupon exceeds yield → premium is being amortized → posts as **premium amortization** offset to income.

---

## 10. Running Totals (Per-Day Row)

Each row emitted carries:

| Column | Definition |
|--------|------------|
| `balance` | Principal at end-of-day (after events + PIK capitalization). |
| `drawnBalance` | Drawn portion of the facility (excludes PIK capitalizations). |
| `carryingValue` | Book value after amortization of discount/premium. |
| `couponRate` | Effective rate applied this day. |
| `dailyCash` | Cash interest accrued this day. |
| `cumInterestAccrued`, `cumInterestEarned` | Running sum of `dailyCash`. |
| `dailyPik` | PIK accrued this day. |
| `cumPikAccrued` | PIK pool (resets to 0 on capitalization days). |
| `cumPikEarned` | Lifetime PIK earned (never reset — for reporting). |
| `capitalized` | PIK rolled into principal today (0 on non-anchor days). |
| `amortDaily` | Discount/premium amortized today. Signed. |
| `cumAmort` | Running amortization total. Signed. |
| `nonUseFee` | Non-use fee accrued today. |
| `cumNonUseFee` | Running non-use fee total. |
| `hasEvent` | `true` if the day had a principal event or a capitalization. |

---

## 11. Period Summarization

`summarize(rows, periodBegin, periodEnd)` filters the day rows to the window and produces:

```
totalCashAccrual = Σ dailyCash       over window
totalPikAccrual  = Σ dailyPik        over window
totalCapitalized = Σ capitalized     over window
totalAmort       = Σ amortDaily      over window      (signed)
totalNonUseFee   = Σ nonUseFee       over window
daysCount        = count of rows in window
openingBalance   = balance at window[0]
closingBalance   = balance at window[last]
closingCarrying  = carryingValue at window[last]
```

These totals drive the summary cards and the journal entry generator.

---

## 12. Journal Entries (DIU)

`generateDIU()` emits paired debit/credit entries. Each pair rolls up the period total to a single entry.

| Trigger                       | Debit | Credit | Debit Account | Credit Account | Comment |
|-------------------------------|-------|--------|---------------|----------------|---------|
| `totalCashAccrual != 0`       | Income - Daily Accrued Interest | Interest Receivable | 23000 | 40100 | "Interest Adjustment for *periodEnd*" |
| `totalCapitalized != 0`       | PIK Investment | Interest Receivable | 40100 | 23000 | "PIK Capitalization for *periodEnd*"  *(posted with negative `originalAmount` to reflect the reclass)* |
| `|totalAmort| > 0.005`        | Accretion/Amort Offset | Discount Accretion *or* Premium Amortization | 23000 | 40150 | Label flips on sign of `totalAmort` |
| `totalNonUseFee > 0.005`      | Non-Use Fee Receivable | Non-Use Fee Income | 23100 | 40200 | "Non-use fee for *periodEnd*" |

Each entry is stamped with:
- `legalEntity`, `leid`, `deal`, `position`, `incomeSecurity` (copied from the instrument)
- `glDate = effectiveDate = period.end`
- `batchType = "Loan Calculator"`
- `batchComments = "Loan Calculator Entries from periodStart to periodEnd"`
- `allocationRule = 'By Commitment and GL Date'` (credit side) or `'Non-Dominant'` (debit side)
- `originalAmount`, `amountLE`, `amountLocal = |amount|`, `fx = 1`

A one-basis-point dead-zone (`0.005` dollars) suppresses zero-rounding noise on amortization and non-use fee entries.

---

## 13. IRR / Yield Solver Details

Used inside `effectiveInterestPrice`.

```
npv(rate, cashflows)    = Σ cf.amount / (1 + rate)^cf.t
solveYield(target, cfs) = bisect r on [-0.99, 5.0] s.t. npv(r, cfs) == target
```

- **Bracket**: `[-0.99, 5.0]`. Fails cleanly (returns `null`) if the function doesn't change sign across the bracket.
- **Iterations**: 200 max.
- **Tolerance**: `|f(mid)| < 1e-9`.

The secant refinement downstream tightens yield against the actual daily-grid schedule, since the bisection uses an annualized cash-flow approximation.

---

## 14. Worked Example — Alliance Manufacturing

**Inputs**

- `faceValue = 25,000,000`, `purchasePrice = 25,000,000` (at par)
- `settlementDate = 2019-01-15`, `maturityDate = 2020-03-05`
- `dayBasis = ACT/360`, `accrualFreq = daily`
- `coupon.type = Fixed`, `coupon.fixedRate = 0.12`
- `pik.enabled = true`, `pik.rate = 0.14`, `capFreq = Monthly` (anchor = 15th of each month)
- `amortization.method = none`

**Daily cash accrual** on day 1 (Jan 15, 2019):

```
dcf         = 1/360 = 0.002778
dailyCash   = 25,000,000 × 0.12 × 0.002778 = 8,333.33
```

**Daily PIK accrual** on day 1:

```
dailyPik    = 25,000,000 × 0.14 × 0.002778 = 9,722.22
```

**One month later** (Feb 15, 2019 — capitalization day):

```
cumPikAccrued ≈ 9,722.22 × 31 = 301,388.82
capitalized    = 301,388.82
balance_new    = 25,000,000 + 301,388.82 = 25,301,388.82
cumPikAccrued  = 0   (reset)
```

Next day's `dailyPik` is computed on the new `25,301,388.82` balance, which is the PIK compounding mechanism.

**Period totals** (Jan 1 – Mar 5, 2020) — summed across the window:

```
totalCashAccrual = Σ dailyCash over that window
totalPikAccrual  = Σ dailyPik  over that window
totalCapitalized = sum of PIK that got rolled on Jan 15, Feb 15, Mar 5
```

---

## 15. Worked Example — Copperleaf Discount Bond (EIR from Price)

**Inputs**

- `faceValue = 10,000,000`, `purchasePrice = 9,250,000` (bought at 92.5% of par)
- `settlementDate = 2024-06-01`, `maturityDate = 2030-06-01` (6 years)
- `dayBasis = 30/360` (daysPerYear = 360)
- `coupon.fixedRate = 0.08`
- `amortization.method = effectiveInterestPrice`

**Stage 1 — bisection seed**

```
cashflows: {t=1..5, amount=800,000}, {t=6, amount=10,800,000}
solveYield(9,250,000, cashflows) → y ≈ 0.0934 (bisection result, ~9.34%)
```

**Stage 2 — secant refinement** tightens `y` so the daily schedule lands on face at maturity. Final `y ≈ 0.0935–0.094` depending on the exact day count.

**Day-one application** (June 1, 2024):

```
dcf              = 1/360
dailyCash        = 10,000,000 × 0.08 × (1/360) = 2,222.22
effectiveIncome  = 9,250,000 × 0.0935 × (1/360) = 2,402.43
dailyAmort       = 2,402.43 - 2,222.22 = 180.21      (discount accretion)
carryingValue    = 9,250,000 + 180.21 = 9,250,180.21
```

Over the full 6 years, `carryingValue` accretes upward from 9,250,000 and lands on exactly 10,000,000 at maturity (the secant target).

---

## 16. Edge Cases and Safeguards

| Situation | Engine behavior |
|-----------|-----------------|
| `settlementDate > maturityDate` | `buildSchedule` returns `[]`. |
| `purchasePrice` missing on EIR methods | Falls back to `faceValue` (pure par instrument — no discount to accrete). |
| Bisection fails to bracket | `solveYield` returns `null`; engine seeds `effectiveYield = couponRateNominal`, then the secant refinement takes over. |
| PIK enabled but `cumPikAccrued = 0` on an anchor day | No capitalization entry emitted; row still flagged if other events occur. |
| Non-use fee enabled but `commitment ≤ drawnBalance` | `dailyNonUse = 0`. |
| Event dated before `settlementDate` or after `maturityDate` | Silently ignored by `eventsOn` (day is outside the grid). |
| Holiday selected but `skipHolidays = false` | Holidays are visible for reporting but do NOT suppress accrual. |
| `period.begin < settlementDate` | The summary window simply has no rows before settlement; totals will only reflect rows that exist. |

---

## 17. Precision and Rounding

- All intermediate math is done in IEEE-754 doubles. No per-step rounding.
- Display-only rounding happens in `fmtMoney` (2 dp) and `fmtPct` (4 dp).
- Journal entry dead-zones (`0.005` dollars) avoid one-cent ghost entries on amortization and non-use fee lines that rounded to zero.
- The IRR solver's tolerance is `1e-9` on NPV and `1e-3` on the daily-schedule refinement (one-tenth of a cent on a million-dollar carrying value).

---

## 18. Sign Conventions Summary

| Quantity       | Positive means | Negative means |
|----------------|----------------|----------------|
| `dailyCash`    | Interest earned | (not emitted negative) |
| `dailyPik`     | PIK earned | (not emitted negative) |
| `capitalized`  | PIK rolled into balance | (not emitted negative) |
| `amortDaily`   | Discount accretion (income) | Premium amortization (offset to income) |
| `nonUseFee`    | Fee earned on undrawn | (not emitted negative) |
| `draw`         | Balance increase | (not emitted negative) |
| `paydown`      | Balance decrease | (not emitted negative) |

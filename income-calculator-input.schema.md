# Income Calculator — Inbound Payload Reference

This document describes the fields the calculator consumes to produce a daily accrual schedule, PIK capitalization, amortization of discount/premium, non-use fees, and period totals.

The payload has two top-level objects: **`period`** (the accrual window to compute) and **`instrument`** (the security being valued).

---

## 1. `period` — Accrual Window

| Field   | Type        | Required | Description |
|---------|-------------|----------|-------------|
| `begin` | ISO date    | Yes      | First day of the accrual window. Must fall on/after `instrument.settlementDate`. |
| `end`   | ISO date    | Yes      | Last day of the accrual window. Must fall on/before `instrument.maturityDate`. |
| `last`  | ISO date    | Yes      | Last day of the *prior* period — i.e. the day before `begin`. Used to carry opening balances forward. |

---

## 2. `instrument` — Security Master

### 2.1 Identity

| Field            | Type    | Required | Description |
|------------------|---------|----------|-------------|
| `id`             | string  | Yes      | Stable internal key for the instrument. |
| `legalEntity`    | string  | Yes      | Owning fund / legal entity name (e.g. "FIS Capital Partners I"). |
| `leid`           | integer | Yes      | Legal entity ID. |
| `deal`           | string  | Yes      | Portfolio company / deal name. |
| `position`       | string  | Yes      | Specific tranche or position label. |
| `incomeSecurity` | string  | Yes      | The income-bearing security's display name. |
| `preset`         | string  | No       | Friendly label shown in the UI header. |

### 2.2 Principal Amounts

| Field           | Type   | Required | Description |
|-----------------|--------|----------|-------------|
| `faceValue`     | number | Yes      | Par / face amount, in instrument currency (USD assumed). |
| `purchasePrice` | number | Yes      | Amount paid at settle. `faceValue − purchasePrice` is the discount (positive) or premium (negative) that gets amortized. |
| `commitment`    | number | Yes      | Facility commitment. For term loans and bonds this equals `faceValue`. For revolvers it's the line size; `faceValue` is the drawn balance. The non-use fee is computed on `commitment − drawnBalance`. |

### 2.3 Dates

| Field            | Type      | Required | Description |
|------------------|-----------|----------|-------------|
| `settlementDate` | ISO date  | Yes      | First accrual day. Discount/premium amortization anchors here unless `amortStart` is set. |
| `maturityDate`   | ISO date  | Yes      | Last accrual day. |
| `amortStart`     | ISO date  | No       | Override the start of the discount/premium amortization window. Defaults to `settlementDate` when null. |
| `amortEnd`       | ISO date  | No       | Override the end of the amortization window. Defaults to `maturityDate` when null. Useful when the discount amortizes to a call date instead of maturity. |

### 2.4 Day-count & Accrual Flags

| Field                       | Type    | Required | Description |
|-----------------------------|---------|----------|-------------|
| `dayBasis`                  | enum    | Yes      | `"ACT/360"`, `"ACT/365"`, `"30/360"`, or `"ACT/ACT"`. Governs the day-count divisor. |
| `accrualFreq`               | enum    | Yes      | `"daily"`, `"monthly"`, `"biMonthly"`, `"quarterly"`. Determines how interest is bucketed into the schedule (daily still accrues daily under the hood). |
| `accrualDayCountExclusive`  | boolean | Yes      | If `true`, the accrual start day is *excluded* (t+1 convention). If `false`, start day is included. |
| `paydateDayCountInclusive`  | boolean | Yes      | If `true`, the pay/end date is included in accrual. If `false`, it is excluded. |
| `interestPreviousDay`       | boolean | No       | If `true`, applies rate resets one day prior (for some floating-rate conventions). Default `false`. |
| `holidayCalendar`           | enum    | No       | `"none"`, `"US"`, `"UK"`, or `"TARGET"`. Identifies which weekday holidays to recognize. |
| `skipHolidays`              | boolean | No       | When `true` and `holidayCalendar` ≠ `"none"`, zero-accrual days are emitted for holidays. Default `false`. |

### 2.5 Coupon

| Field                 | Type           | Required | Description |
|-----------------------|----------------|----------|-------------|
| `coupon.type`         | enum           | Yes      | `"Fixed"` or `"Floating"`. |
| `coupon.fixedRate`    | number (decimal) | Yes if Fixed | Annual fixed coupon, e.g. `0.12` = 12%. |
| `coupon.floatingRate` | number         | Yes if Floating | Current index rate (e.g. SOFR), decimal form. |
| `coupon.spread`       | number         | Yes if Floating | Credit spread over the index, decimal form. |
| `coupon.floor`        | number or null | No       | Minimum effective rate. `null` = no floor. |
| `coupon.cap`          | number or null | No       | Maximum effective rate. `null` = no cap. |

Effective rate = clamp(`floatingRate + spread`, `floor`, `cap`) for Floating; else `fixedRate`.

### 2.6 PIK (Payment-In-Kind)

| Field                          | Type    | Required | Description |
|--------------------------------|---------|----------|-------------|
| `pik.enabled`                  | boolean | Yes      | When `true`, a separate PIK accrual runs alongside cash interest and capitalizes into principal. |
| `pik.rate`                     | number  | Yes if enabled | Annual PIK rate (decimal). |
| `pik.capitalizationFrequency`  | enum    | Yes if enabled | `"Monthly"`, `"Quarterly"`, `"SemiAnnual"`, `"Annual"`. When the accrued PIK rolls into the principal balance. |

### 2.7 Non-Use (Commitment) Fee

| Field                  | Type    | Required | Description |
|------------------------|---------|----------|-------------|
| `nonUseFee.enabled`    | boolean | Yes      | When `true`, charges a fee on the undrawn portion (`commitment − drawn`). |
| `nonUseFee.rate`       | number  | Yes if enabled | Annual non-use rate (decimal), e.g. `0.005` = 50 bps. |

### 2.8 Principal Movements

| Field                 | Type   | Required | Description |
|-----------------------|--------|----------|-------------|
| `principalRepayment`  | enum   | Yes      | `"AtMaturity"` (bullet), `"Scheduled"` (uses `principalSchedule`), or `"None"`. |
| `principalSchedule`   | array  | Yes      | Ordered list of principal movements. Always include an `initial` entry at `settlementDate`. See 2.8.1. |

#### 2.8.1 `principalSchedule[*]`

| Field    | Type     | Description |
|----------|----------|-------------|
| `date`   | ISO date | Day the movement posts. |
| `type`   | enum     | `"initial"` (starting balance at settle), `"draw"` (revolver draw / add-on, increases balance), `"paydown"` (scheduled amortization, decreases balance). |
| `amount` | number   | Positive dollar amount. Direction is implied by `type`. |

### 2.9 Amortization (Discount / Premium)

| Field                      | Type           | Required | Description |
|----------------------------|----------------|----------|-------------|
| `amortization.method`      | enum           | Yes      | `"none"`, `"straightLine"`, `"effectiveInterestPrice"`, `"effectiveInterestFormula"`, `"effectiveInterestIRR"`. See 2.9.1. |
| `amortization.spread`      | number         | No       | Used when method = `effectiveInterestFormula`. Yield = coupon + this spread. |
| `amortization.yieldOverride` | number or null | No     | Used when method = `effectiveInterestIRR`. Explicit yield in decimal form. |

#### 2.9.1 Amortization Methods

| Value                        | When to Use |
|------------------------------|-------------|
| `none`                       | No discount/premium — bond bought at par. |
| `straightLine`               | Amortize (`faceValue − purchasePrice`) evenly across the amortization window. |
| `effectiveInterestPrice`     | Solve the effective yield from `purchasePrice` and the projected cash flows. Best for discount bonds. |
| `effectiveInterestFormula`   | Yield = coupon rate + user-supplied spread. Best for floating instruments. |
| `effectiveInterestIRR`       | User supplies an explicit yield via `yieldOverride`. |

### 2.10 Income Security Type (Template)

| Field  | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | enum | Yes      | Identifies the pre-configured template. Setting this drives the defaults on amortization, coupon, PIK, non-use fee, and repayment style. |

Valid `type` values:

| `type`                | Maps To |
|-----------------------|---------|
| `simpleDaily`         | Plain daily accrual, fixed coupon. |
| `straightLineFixed`   | #1 Straight-line amortization, fixed coupon. |
| `straightLineVar`     | #2 Straight-line amortization, variable coupon. |
| `eirPriceFixed`       | #3 Effective interest from price, fixed coupon. |
| `eirPriceVar`         | #4 Effective interest from price, variable coupon. |
| `eirFormulaFixed`     | #5 Effective interest from formula, fixed coupon. |
| `eirFormulaVar`       | #6 Effective interest from formula, variable coupon. |
| `eirIRRFixed`         | #7 Effective interest + IRR override, fixed coupon. |
| `eirIRRVar`           | #8 Effective interest + IRR override, variable coupon. |
| `pikNoteFixed`        | #9 PIK-enabled note, fixed. |
| `pikNoteVar`          | #9 PIK-enabled note, variable. |
| `bulletAtMaturity`    | #11 Principal bullet at maturity. |
| `scheduledPaydowns`   | #12 Scheduled principal paydowns. |
| `drawsAddons`         | #20 Revolver with draws & add-ons. |
| `yieldOverride`       | #13 Effective yield override. |
| `nonUseFeeFacility`   | #15 Revolver with non-use fee. |
| `discountAmort`       | #16 Discount amortization (bond below par). |
| `premiumAccretion`    | #17 Premium accretion (bond above par). |
| `biMonthly`           | #19 Bi-monthly accrual. |
| `floatingCapsFloors`  | #21 Floating with caps & floors. |

---

## 3. Minimum Viable Payload

For a plain vanilla daily-accrual fixed-coupon note, the **minimum required** fields are:

```json
{
  "period":     { "begin": "...", "end": "...", "last": "..." },
  "instrument": {
    "id":             "...",
    "legalEntity":    "...", "leid": 0,
    "deal":           "...", "position": "...", "incomeSecurity": "...",
    "faceValue":      0,
    "purchasePrice":  0,
    "commitment":     0,
    "settlementDate": "...", "maturityDate": "...",
    "dayBasis":                 "ACT/360",
    "accrualFreq":              "daily",
    "accrualDayCountExclusive": false,
    "paydateDayCountInclusive": true,
    "coupon":              { "type": "Fixed", "fixedRate": 0.0 },
    "pik":                 { "enabled": false },
    "nonUseFee":           { "enabled": false },
    "principalRepayment":  "AtMaturity",
    "principalSchedule":   [ { "date": "...", "type": "initial", "amount": 0 } ],
    "amortization":        { "method": "none" },
    "type":                "simpleDaily"
  }
}
```

Add more blocks (coupon caps/floors, PIK, non-use fee, amort window, holidays) as the instrument complexity requires.

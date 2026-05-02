# Scenario Coverage — How to Test in the Income Calculator

Maps the scenarios from `NEW INCOME Calculation requirements.xlsx` (sheets *Scenario questions for Debts* and *Scenario Questions - Guarantees*) to what the calculator currently demonstrates and how you can verify each in the UI.

---

## Guarantee scenarios (Volt example)

Pick **NWF Sustainable Infrastructure → Volt → Volt · Financial Guarantee on £1bn BoA Loan (£800m covered)** in the Income Security dropdown.

### 1. Multiple underlying loans

Status: **Not covered yet** (single underlying loan). The data model has the seam — `coveredAmount`, `marginSchedule`, and a single `principalSchedule` per instrument. Multi-underlying support would require restructuring the principal schedule to be per-underlying.

How to test what's there: the Volt example shows one underlying with a 36-month availability and 18-tranche repayment schedule.

### 2. Flexible guarantee fee structure (flat OR % of margin)

Status: **Covered**. Each fee in `instrument.fees` has a `mode` (`percent` / `flat`) and a `base` (`commitment` / `undrawn` / `drawn` / `covered` / `face`).

How to test:
1. Open Volt example → scroll to the **Fees · IFRS 9 / 15 Treatment** card.
2. The Guarantee Fee row shows mode=percent, rate=0.005 (0.5%), base=drawn — i.e. 0.5% p.a. × drawn covered amount.
3. Change mode to `flat`, set Flat Amount = e.g. £4,000,000 — the engine will spread that across the accrual window. Watch the schedule grid update in real time.
4. The Schedule grid (Schedule tab) now shows a **Fee · Guarantee Fee** column so you can see daily accrual.

### 3. Time-based guarantee fee adjustments (ratchets)

Status: **Partial — for margin only (not for fee rates yet).** The margin ratchet table on the SONIA/RFR card already supports stepped margins by date.

How to test the *margin* ratchet (this drives the underlying loan's effective rate, which feeds rate-linked fees):
1. Open Volt → scroll to **SONIA / RFR · Margin Ratchet & ESG Adjustment**.
2. Add a step with From = 2030-01-01, To = 2032-12-31, Margin (bps) = 125. Save.
3. The schedule grid's Current Rate column will jump to SONIA + 125 bps on those dates.

For *fee* ratchets specifically (e.g. guarantee fee % stepping over time), the data model would need a `feeSchedule[]` analogous to `marginSchedule`. Roadmap.

### 4. Irregular and independent payment schedules

Status: **Partial.** Each fee has its own `frequency` (`oneOff` / `daily` / `monthly` / `quarterly` / `semiAnnual` / `annual`) and `accrueFrom` / `accrueTo` window — independent of the underlying loan's interest period.

How to test:
1. Open Volt → look at Guarantee Fee (`semiAnnual`) vs NWF Commitment Fee (`semiAnnual` but `accrueTo = 2028-12-18`, the availability period end, NOT the maturity).
2. The schedule grid shows the NWF Commitment Fee column going to zero after 18 Dec 2028 while Guarantee Fee continues until maturity.

Custom payment dates per fee are still TBD — currently driven by the frequency string. A `paymentSchedule: [...dates...]` field is a natural extension.

---

## Debt scenarios (Libra 2 / SP023 example)

Pick **NWF Sustainable Infrastructure → Libra 2 → HSBC Facility B4 - 100%** in the Income Security dropdown.

| # | Requirement | Status | How to test |
|---|---|---|---|
| 1 | Counterparty / deal naming flexibility | Covered | Volt has `counterpartyId='CP0112'`, `transactionId='GP017 & GP018'` on the data; LE/Deal/Position cascade on screen |
| 2 | Bilateral / Syndicated flag | Covered | `bilateralFlag` field on instrument data (Libra 2 = Bilateral) |
| 3 | Agent details storage | Captured | `agentName='HSBC Bank'` stored; not yet a UI field |
| 4 | Facility name / co-lenders | Partial | Position name = "HSBC Facility B4 - 100%". Co-lender split not modelled |
| 5 | Commitment amount + indexation | Partial | `commitment` editable. Ratchets supported via `marginSchedule`. FX not modelled |
| 6 | Signing date / close date separation | Captured | `settlementDate`, `availabilityEnd`, `maturityDate` distinct fields |
| 7 | Drawstops | Not covered | Roadmap |
| 8 | Availability period | **Covered** | `availabilityEnd` field. Commitment fee accrues through this date only — see Schedule grid: NWF Commitment Fee column zeros out after 18 Oct 2029 |
| 9 | Accounting treatment (amortised cost / FV) | **Covered** | `ifrs.ifrs9Classification` dropdown. AmortisedCost (Libra 2/Volt), FVTPL (XYZ Buyout, ABCDEF) |
| 10 | Fixed/floating rate mix, conversions | Partial | Coupon Type dropdown (Fixed / Floating / SONIA). Mid-life conversion not yet modelled |
| 11 | Base margin ratchets | **Covered** | SONIA / RFR margin ratchet table. Try editing the Libra 2 8-step ratchet |
| 12 | Credit spread (ESG, IP-specific) | **Covered** | ESG Adjustment From + bps fields. Libra 2 uses -2.5 bps from 22 May 2025 |
| 13 | SONIA reference rate + fallback | Partial | `rfr.baseRate` + `lookbackDays` editable. Fallback logic not implemented |
| 14 | Commitment fee ratchets | Partial | Single rate per fee; date-effective rate steps not yet |
| 15 | Commitment fee payment dates (decoupled) | **Covered** | Fee `accrueFrom`/`accrueTo` independent of interest payment cadence. See Libra 2 — accrual goes through 10 Oct 2029 only |
| 16 | SONIA lookback period flexibility | Captured | `rfr.lookbackDays` field (5 default). Used informationally — engine takes today's fix |
| 17 | Repayments (cash sweep, multi-drawdown) | Partial | Scheduled repayments per drawdown supported (Volt = 18 tranches). Cash sweep / annuity not yet |
| 18 | Interest payment dates | Partial | Day-count basis + accrual frequency editable. Decoupled accrual/payment schedules — partial |
| 19 | Interest periods per drawdown | Partial | Single interest-period setup per instrument |
| 20 | Drawdown management | **Covered** | Principal Schedule grid — add draws / repayments / paydowns inline. Each event tagged with status (actual/forecast) in the data |
| 21 | Holiday calendars | **Covered** | Holiday Calendar dropdown (UK Bank, US Federal, ECB TARGET) + Skip-on-holiday toggle |
| 22 | CLN / equity conversion | Not covered | Roadmap |
| 23 | Multiple fee types | **Covered** | Fees · IFRS 9 / 15 Treatment card. Add as many fees as needed (arrangement, commitment, guarantee, other), each with its own IFRS treatment |
| 24 | EIR vs non-EIR fees | **Covered** | Per-fee IFRS treatment dropdown — IFRS9-EIR pools fees into deferred income, IFRS15 recognises directly |
| 25 | Restructuring events | Not covered | Roadmap |
| 26 | Notice management | Not covered | Out of scope for income calc |
| 27 | Document management | Not covered | Out of scope for income calc |
| 28 | Revolving facility features | **Covered** | Northwind RCF example. Non-use fee on undrawn, draws/paydowns/draws sequence |
| 29 | Default interest / default fees | Not covered | Roadmap |
| 30 | Reminders & notifications | Not covered | Out of scope for income calc |
| 31 | Workday integration | Not covered | Out of scope for income calc |
| 32 | Run interest + fees separately, approval workflow | Partial | DIU export splits interest pair / fee pair / EIR accretion pair — approvable separately downstream |
| 33 | Forecast vs contractual drawdowns | **Covered** | Each event in `principalSchedule` has a `status` field (`actual` / `forecast`) — see Volt's data |

---

## Equity scenarios (XYZ Buyout Fund / ABCDEF Series C)

Pick **NWF Renewable Equity → XYZ Buyout Fund (GBP)** or **ABCDEF Software Ltd**.

| Capability | Status | How to test |
|---|---|---|
| FVTPL classification | **Covered** | `ifrs.ifrs9Classification = FVTPL` on both equity examples |
| Capital calls staggered over years | **Covered** | XYZ Buyout: 6 capital calls totalling £50m over 3 years. See Principal Schedule grid |
| Distributions / realisations | **Covered** | XYZ Buyout: 4 distributions in years 7-11 (paydown events) |
| Stepped management fee (1.75%/1.25%) | **Covered** | Two separate fee entries with non-overlapping `accrueFrom`/`accrueTo` windows. See KPI breakdown |
| Dividend recognition (point-in-time) | **Covered** | ABCDEF: 3 illustrative dividend events as `IFRS15-pointInTime` fees |
| Cap table snapshot | Captured | `capTable` field on ABCDEF — not yet a UI panel |
| Preferred return / GP carry | Captured | Stored in `ifrs` block on XYZ Buyout — calculation not implemented |
| 8% IRR / waterfall | Not covered | Roadmap |
| Fund extension / wind-down logic | Not covered | Modelled implicitly via maturity date |

---

## Summary — what to demo

For a complete walkthrough showcasing the most distinctive scenarios:

1. **Libra 2** — IFRS 9 EIR fee accretion + IFRS 15 commitment fee + SONIA margin ratchet + ESG step.
2. **Volt** — Financial guarantee with covered tranche, multi-fee structure (Arrangement / Guarantee / NWF Commitment), 18-tranche repayment ladder.
3. **XYZ Buyout Fund** — FVTPL equity, stepped management fee (1.75% → 1.25%), capital calls + distributions.
4. **ABCDEF Series C** — Direct FVTPL equity with point-in-time dividend recognition.
5. **Northwind RCF** — Revolver with non-use fee on undrawn (compare to commitment-fee approach in Libra 2).

Each instrument's full life schedule is now visible on selection (begin = settlement, end = maturity) and the Schedule grid shows daily accrual per individual fee.

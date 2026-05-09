# PortF → PCS Cashflow Excel Template — Guide

**Audience:** PortF deal-team operators producing the canonical cashflow file for PCS / Investran ingestion.
**Files:** `portf-cashflow-template.xlsx` (blank template) · `portf-cashflow-volt-example.xlsx` (populated Volt example).
**Version:** 2026-05-08 · ISO yyyy-mm-dd dates · GBP/USD/EUR/JPY in deal currency.

---

## 1. Why this template exists

The integration layer's Stage 1 reads this file to build the canonical PortF payload that feeds the rest of the pipeline (PCS accounting → Workday GL → reconciliation → PortF feedback). Following the template means we get consistent metadata, consistent fee setup, and a predictable data table — and the parser doesn't have to guess.

**Two outputs from a correctly-formatted file:**

1. The matched seed instrument is updated with the Excel's metadata + fees, OR
2. A brand-new synthetic instrument is created and registered automatically (when no match found in the seed dataset).

Either way, the rest of Stages 2–5 work without any manual configuration.

---

## 2. Layout — at a glance

| Section | Excel range | Purpose |
|---|---|---|
| **A. Setup metadata** | Rows 1-15, columns A:B | Deal-level static data (label : value pairs) |
| **Spacer row** | Row 16 | (Empty — visual separation, optional) |
| **B. Per-fee setup blocks** | Rows 1-9, columns H, J, L, N, … | One column per fee — name, posting type, basis, rate, frequencies |
| **C. Section labels** | Rows 11-12 | "Balance Basis" / "Principal Balance" / "Unfunded Balance" / "Fee Cash" |
| **D. Data table headers** | Row 17 | "Date / Initial Purchase / Drawdown / Principal Payment / Day count / Amount / Amount" + per-fee "Rate / Amount" |
| **E. Data rows** | Row 18+ | One row per period — daily, monthly, quarterly, etc. |

---

## 3. Section A — Setup metadata

Rows 1-15 in columns A (label) and B (value). The parser is case-insensitive on labels and accepts the synonyms shown.

### Required fields

| Excel label | Synonyms accepted | Example value | Notes |
|---|---|---|---|
| `Company` | — | `Volt - Guarantee` | Trading / familiar deal name |
| `Debt Type` | — | `Guarantee` | One of: Loan, Bond, Guarantee, Revolver, Equity, Multi-Tranche |
| `Loan Start Date` | — | `2025-12-18` | Settlement / signing date — Excel date or ISO string |
| `Loan End Date` | — | `2037-12-17` | Final maturity / termination date |
| `Day Count Convention` | — | `ACT/365` | One of: ACT/360, ACT/365, ACT/ACT, 30/360 |
| `Interest Accrues` | — | `Same day` | One of: Same day, Lookback, Compounded |
| `Total Commitment` | — | `1000000000` | Notional in deal currency (no thousand separators in source) |
| `Currency` | `CCY` | `GBP` | ISO 3-letter code |
| `Legal Entity` | `LE` / `Legal Entity Name` | `NWF Sustainable Infrastructure` | Booking entity for journal posting |
| `LEID` | `LE ID` / `Legal Entity Id` | `42` | Investran legal-entity ID (numeric) |
| `Position` | `Position Name` | `NWF Guarantor Position · Volt covered tranche` | Position label carried into JE rows |
| `Income Security` | `Security` / `Security Name` | `Volt Financial Guarantee on £1bn BoA Loan (£800m covered)` | Security descriptor for the GL |

### Optional fields

| Excel label | Synonyms | Example value | Notes |
|---|---|---|---|
| `Position ID` | `PositionId` | `POS-NWF-VOLT-GUAR` | If you have a stable position identifier |
| `Security ID` | `SecurityId` | `SEC-VOLT-GP017-FINGUAR` | Stable security identifier |
| `Counterparty` | `CP` | `Bank of America` | Borrower / agent name (informational) |

### Adding more setup fields

The parser captures **every label/value pair** in column A:B before the data table header. So you can add custom rows like `A16=Coupon Spread B16=250bps` or `A16=Internal Approval Ref B16=SP023` and they'll be displayed in the Phase 1 setup panel automatically (as informational rows, not used by the engine).

---

## 4. Section B — Per-fee setup blocks

Each fee occupies **one column** for setup (rows 1-9) and **two columns** in the data table (Rate, Amount). Fees start at column **H** and extend right (J, L, N, P, Q, ...) — one fee = 2 columns.

| Row | Label | Example | Notes |
|---|---|---|---|
| 1 | (Fee name) | `Guarantee Fee` | The fee's display name — appears in JE comments and audit |
| 2 | Posting Type | `Fee` | One of: Interest, Fee, Default Interest, Non-use Fee |
| 3 | Calculation Basis | `Principal Balance` | One of: Principal Balance, Unfunded Balance, Commitment Balance, Covered Balance |
| 4 | Interest Rate Structure | `Fixed` | One of: Fixed, Floating (SONIA + Spread), Floating (SOFR + Spread) |
| 5 | Interest Rate | `0.0167` | Annual rate as decimal — `0.005` = 0.5%; for floating, use the all-in rate |
| 6 | Accrual Frequency | `Semi-annually (Anniversary)` | One of: Daily, Monthly, Quarterly, Semi-annually, Annually, One-off |
| 7 | Settlement Frequency | `Semi-annually` | When the fee is cash-settled (vs accrued) |
| 8 | Settlement Type | `Cash` | One of: Cash, Capitalize |
| 9 | First Settlement Date | `2026-10-31` | First fee settlement / cash-pay date |

### Variable number of fees — **the parser is fully flexible**

- **Add a new fee** by populating columns to the right of the existing ones (e.g. fee 5 starts at column P, fee 6 at column R).
- **Remove a fee** by leaving its setup column blank — the parser ignores empty fee columns.
- **No upper limit** — the parser scans columns H through DA (8 to 119, ~50+ fees).
- **Order doesn't matter** — fees are displayed in the order they appear in the Excel.

### Fee kinds → IFRS treatment routing

The parser uses the fee name to route each fee to a default IFRS treatment in Stage 2 (you can override per-fee in the Treatment panel later):

| Fee name pattern | Default IFRS treatment | Default GL account |
|---|---|---|
| `Arrangement Fee` / `Origination Fee` / `Upfront Fee` | IFRS 9 EIR (capitalised into yield) | 421000 |
| `Commitment Fee` / `Non-use Fee` / `Unused Line Fee` | IFRS 15 over time | 492200 |
| `Guarantee Fee` | IFRS 15 over time | 492300 |
| `Management Fee` | IFRS 15 over time | 492400 |
| `Dividend` | IFRS 15 point in time | 492500 |
| `Underlying Debt` (or anything containing "Interest") | Interest income | 421000 |
| Anything else | IFRS 9 EIR (default) | 492000 |

---

## 5. Section D — Data table

Row 17 carries the data-table headers; rows 18 onwards carry the data.

### Fixed columns A-G

| Column | Header (row 17) | Type | Convention |
|---|---|---|---|
| A | `Date` | Date | Excel date or ISO yyyy-mm-dd. **One row per period** (daily, monthly, quarterly — your choice). |
| B | `Initial Purchase` | Number | Initial purchase amount (only on first row, if applicable). |
| C | `Drawdown` | Number | **NEGATIVE values represent draw events** (PortF convention). E.g. `-133333333` = £133.3m drawdown. |
| D | `Principal Payment` | Number | **POSITIVE values represent repayments**. |
| E | `Day count` | Integer | Days in this accrual period. |
| F | `Amount` | Number | Principal Balance at end of this row (after draw/payment). |
| G | `Amount` | Number | Unfunded Balance at end of this row. |

### Per-fee columns (H/I, J/K, L/M, N/O, …)

For each fee in Section B, the data table has:

- **Rate** column (e.g. H, J, L, N) — the fee rate applied for this period (decimal). Useful when the rate ratchets/changes. If the rate is constant, this matches Section B's row 5.
- **Amount** column (e.g. I, K, M, O) — the fee amount accrued for this period in deal currency.

### Row 17 column headers

For the Volt example with 4 fees, row 17 reads:

```
A=Date  B=Initial Purchase  C=Drawdown  D=Principal Payment  E=Day count
F=Amount (Principal Balance)  G=Amount (Unfunded Balance)
H=Rate  I=Amount   ← Underlying Debt
J=Rate  K=Amount   ← Guarantee Fee
L=Rate  M=Amount   ← NWF Commitment Fee
N=Rate  O=Amount   ← Arrangement Fee
```

The parser pairs each fee's setup block with the corresponding Rate/Amount columns by position (column index), so as long as fees stay in the same column positions in both Section B and Section D, everything works.

---

## 6. Worked example — Volt - Guarantee

See `portf-cashflow-volt-example.xlsx` for the full file. Key cells:

### Setup metadata (rows 1-15)

```
A1=Company                  B1=Volt - Guarantee
A2=Debt Type                B2=Guarantee
A3=Loan Start Date          B3=2025-12-18
A4=Loan End Date            B4=2037-12-17
A5=Day Count Convention     B5=ACT/365
A6=Interest Accrues         B6=Same day
A7=Total Commitment         B7=1,000,000,000
A8=Currency                 B8=GBP
A9=Legal Entity             B9=NWF Sustainable Infrastructure
A10=LEID                    B10=42
A11=Position                B11=NWF Guarantor Position · Volt covered tranche
A12=Position ID             B12=POS-NWF-VOLT-GUAR
A13=Income Security         B13=Volt Financial Guarantee on £1bn BoA Loan (£800m covered)
A14=Security ID             B14=SEC-VOLT-GP017-FINGUAR
A15=Counterparty            B15=Bank of America
```

### Fee setup (rows 1-9, cols H-O — 4 fees × 2 cols each)

```
Col H            Col J             Col L                  Col N
─────────────────────────────────────────────────────────────────
H1=Underlying    J1=Guarantee Fee  L1=NWF Commitment Fee  N1=Arrangement Fee
H2=Interest      J2=Fee            L2=Fee                 N2=Fee
H3=Principal Bal J3=Principal Bal  L3=Unfunded Balance    N3=Commitment Balance
H4=Fixed         J4=Fixed          L4=Fixed               N4=Fixed
H5=0.24%         J5=1.67%          L5=0.29%               N5=0.24%
H6=Quarterly     J6=Semi-annually  L6=Semi-annually       N6=One-off
H7=Quarterly     J7=Semi-annually  L7=Semi-annually       N7=One-off
H8=Cash          J8=Cash           L8=Cash                N8=Cash
H9=2026-07-30    J9=2026-10-31     L9=2026-06-19          N9=2025-12-18
```

### Data table (row 17 onwards)

```
Row 17:  A=Date  B=Initial  C=Drawdown  D=Principal Payment  E=Day count
         F=Amount G=Amount  H=Rate I=Amount  J=Rate K=Amount  L=Rate M=Amount  N=Rate O=Amount

Row 18:  2025-12-18  0  0           0  0    0           0           0       0       0       0       0       0       0.24%   2,400,000
Row 19:  2026-03-19  0  0           0  92   0           800,000,000 0       0       0       0       0.29%   584,000 0       0
Row 20:  2026-06-30  0  -133,333,333 0  103  0           800,000,000 0       0       0       0       0.29%   653,972 0       0
Row 21:  2026-07-30  0  0           0  30   133,333,333 666,666,667 0.24%   26,301  0       0       0.29%   159,166 0       0
Row 22:  2026-10-31  0  0           0  93   133,333,333 666,666,667 0.24%   81,534  1.67%   567,488 0.29%   493,416 0       0
Row 23:  2026-12-31  0  -133,333,333 0  61   133,333,333 666,666,667 0.24%   53,479  1.67%   372,303 0.29%   323,561 0       0
```

Reading row 22 (2026-10-31): we have £133m drawn balance · £667m unfunded · this period accrued £81,534 of underlying debt interest, £567,488 of guarantee fee, £493,416 of NWF commitment fee. Arrangement fee was paid up-front (row 18) so no further accrual.

---

## 7. How the parser ingests this file

Stage 1's **Load Excel from PortF** button (or `applyPortFExcel` programmatically):

1. Reads the first non-Summary sheet.
2. Locates the data-table header row by scanning column A for "Date" between rows 6-30.
3. Reads every label:value pair in column A:B above the data-table header → setup metadata.
4. Scans columns H through DA in row 1 for non-empty cells → each is a fee block. Reads 9 rows below for setup attributes; locates the matching Rate/Amount columns in the data-table header.
5. Walks the data table from row 18 onwards, extracting daily/period balance, draws, repayments, and per-fee rate + amount.
6. **Either** matches against an existing seed instrument (by Company name) and overlays Excel data, **or** creates a synthetic instrument from scratch and registers it in the active-deal dropdown.
7. Renders Phase 1 panels: KPI strip, "Loaded setup info" (with source badges), "Loaded fees" (with full spec), cashflow table.
8. Stage 2's **Run Accounting** then takes over — the engine produces JEs from the Excel-derived schedule.

---

## 8. Field-by-field validation rules (for PortF)

When PortF generates this Excel, please ensure:

### Hard requirements (parser will reject)

- **Sheet name** must not be "Summary" (parser skips it). Use the deal's short name or ID (e.g. `voltGuarantee`, `libra2`).
- **Row 17 column A** must be the literal text `Date` (case-insensitive) — this anchors the data table.
- **Setup row order** doesn't matter — the parser reads every label:value pair in column A:B above row 17.

### Soft requirements (parser will warn / use defaults)

- **Dates** as Excel date values OR ISO strings — both work. Parser converts to ISO yyyy-mm-dd internally.
- **Rates** as decimals (`0.005` = 0.5%). If you supply a value > 1 (e.g. `0.5` for 50%) the parser still treats it as decimal — please double-check you're not entering bps.
- **Currency amounts** in deal currency from Setup metadata. The parser doesn't auto-convert.
- **Drawdown sign convention**: NEGATIVE for draws, POSITIVE for repayments. The parser handles either, but stick to convention.

### Recommendations (won't break parsing, but improve clarity)

- Populate **all 15 required setup fields** even if some are repetitive — keeps the source-badge consistency in the Phase 1 setup panel ("Excel ✱" vs "Synthetic 🆕").
- Use **anniversary-aligned settlement frequencies** (e.g. `Quarterly (Anniversary)` rather than just `Quarterly`) when the settlement date is anchored to the deal-start date.
- For **multi-tranche deals** (e.g. fixed + floating), split into separate sheets — one tranche per sheet — rather than encoding tranche distinctions in the fee blocks.

---

## 9. Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| "Could not find data table header row" error | Row 17 column A is not the literal `Date` | Verify cell A17 is `Date`. Move the data table to start at row 17 if it currently starts elsewhere. |
| Fees parsed but Total Accrued = 0 | The data table doesn't have matching Rate/Amount columns for that fee | Check row 17 has `Rate` followed by `Amount` at the right column position for the fee block. |
| Phase 1 setup panel shows fields as "Synthetic 🆕" | Setup field is missing from the Excel | Add the missing row to setup metadata in column A:B. |
| Currency amounts read as zero | Cells contain text not numbers (e.g. "1,000,000" with quotes) | Format cells as Number; remove quotes / commas. The parser uses raw cell values. |
| Wrong instrument matched on load | Company name partial-matches multiple seed instruments | Either set sheet name to the exact instrument id, or use a more unique Company name. |
| Schedule shows 0 interest after load | The Excel doesn't carry rate / interest columns AND there's no matching seed instrument | Fix at source — populate the Underlying Debt / Interest fee block with rate + Amount columns. The parser merges engine values per row when matched against a seed, but a brand-new deal has no engine reference. |

---

## 10. Versioning

This template is **version 2026-05-08**. If PortF needs to add new metadata fields or change the layout:

1. **Adding a setup field** — add a new row to the metadata block (column A:B). The parser auto-detects unknown labels and surfaces them in the Phase 1 setup panel as informational rows.
2. **Adding a fee category** — extend right with new fee blocks. No parser change needed; flexible up to 50+ fees.
3. **Changing column positions** — please notify the integration-layer team. The parser scans for "Date" in column A and dynamically locates fee Rate/Amount column pairs, so minor shifts are tolerated. But moving the Setup metadata block out of column A:B would be a breaking change.

---

## 11. File inventory

| File | Role |
|---|---|
| `portf-cashflow-template.xlsx` | Blank template with 3 placeholder fee columns + sample data rows |
| `portf-cashflow-volt-example.xlsx` | Populated Volt example with 4 fees and 6 settlement dates |
| `PORTF-EXCEL-TEMPLATE-GUIDE.md` | This guide |

Hand the **template + this guide** to PortF. Reference the **Volt example** when discussing fields that need clarification.

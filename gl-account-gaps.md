# Investran GL Account & Transaction Type Gaps

This document inventories every gap between the calculator's DIU output and the Investran chart of accounts (`GL Accounts and tran types.xlsx`). Run the calculator over its 13 seed instruments and the engine flags every transaction type that doesn't have a clean Investran mapping; this doc consolidates those flags and tells your Investran administrator exactly what to create.

The gaps fall into **8 distinct categories**. The calculator currently posts to the closest available Investran account as a placeholder; once your administrator creates the recommended new accounts/transaction types, update `INVESTRAN_GL` in `income-calculator.html` to point at them and the gap chips disappear.

---

## Summary scorecard

Across all 13 seed instruments:

| Category | New GL accounts needed | New transaction types needed | Affected instruments | Total £ exposure |
|---|---|---|---|---:|
| 1. IFRS 15 fee income (lender's view) | **2 (recommended)** | 1+ per fee type | 7 instruments | £61.5M income / 7yr+ |
| 2. IFRS 15 fee receivables | 0 (use 113000) | **1** | 7 instruments | £61.5M |
| 3. IFRS 9 ECL — impairment expense | **1** | 0 | 3 instruments | £170K |
| 4. IFRS 9 ECL — loan loss allowance contra | **1** | 0 | 3 instruments | £170K |
| 5. Hedge accounting — derivatives asset | **1** | 0 | 1 instrument (Libra 3) | varies by MTM |
| 6. Hedge accounting — Cash Flow Hedge Reserve OCI | **1** | 0 | 1 instrument (Libra 3) | varies by MTM |
| 7. Hedge accounting — ineffectiveness / FV hedge P&L | **2** | 0 | 1 instrument (Libra 3) | small |
| 8. Non-use fee income (lender's view) | 0 (use 492000) | **1** | 1 instrument (Northwind RCF) | £491K |
| 9. IFRS 9 §5.4.3 modification gain/loss | **1 (recommended)** | 0 | 0 in seed (data-driven) | n/a |
| 10. Default interest / default fee income | 0 (use 421000 / 492000) | **2** | 0 in seed (data-driven) | n/a |

**Net asks:**
- **8 new GL accounts** (5 strongly recommended; 3 nice-to-have for cleaner reporting)
- **At least 5 new transaction types** under existing accounts

---

## The detailed gap list

### Gap #1 — IFRS 15 fee income (Investran chart treats it as "Other Income - Amendments")

| Currently posts to | Investran account | Investran transaction type |
|---|---|---|
| `492000 Other Income - Amendments` | 492000 | `Income - Other - Amendment fees` (proxy) |

**Affected JE labels** (one per fee type per instrument):
- `Arrangement Fee Income (IFRS 15)` — Libra 2, Libra 3, Volt Multi-Loan — total **£2.32M**
- `Commitment Fee Income (IFRS 15)` — Libra 2, Libra 3 — total **£1.14M**
- `Guarantee Fee Income (IFRS 15)` — Volt, Volt Multi-Loan — total **£48.03M**
- `NWF Commitment Fee Income (IFRS 15)` — Volt — total **£2.49M**
- `Management Fee (Investment Period) Income (IFRS 15)` — XYZ Buyout Fund — total **£4.38M**
- `Management Fee (Post-Investment) Income (IFRS 15)` — XYZ Buyout Fund — total **£2.72M**
- `Dividend Income FY2027 / FY2028 / FY2030 Income (IFRS 15)` — ABCDEF Series C — total **£4.00M**

**Recommendation — create new GL accounts:**

| New Account | Recommended name | Hosts what |
|---|---|---|
| **492100** | Arrangement Fee Income | One-off fees taken at signing, IFRS 15 point-in-time |
| **492200** | Commitment Fee Income | Fees on undrawn capacity, IFRS 15 over-time |
| **492300** | Guarantee Fee Income | Fees on covered/drawn guarantee tranche, IFRS 15 over-time |
| **492400** | Management Fee Income | LP-side fund management fees |
| **492500** | Dividend Income (Equity) | IFRS 15 point-in-time, distinct from the existing 431000 unqualified dividend |

If you'd rather minimise account proliferation: keep them all in 492000 but create **6 new transaction types** under 492000 (one per category above) so reporting can still split them.

---

### Gap #2 — IFRS 15 fee receivables (Investran has no specific transtype)

| Currently posts to | Investran account | Investran transaction type |
|---|---|---|
| `113000 Accounts Receivable` | 113000 | `Other receivable` (proxy) |

**Affected JE labels** (every fee receivable + clear pair):
- All 7 fee types listed above — total exposure mirrors Gap #1 (£61.5M+ across all instruments)

**Recommendation — add new transaction types under 113000:**

| Account | New transaction type |
|---|---|
| 113000 Accounts Receivable | `Fee receivable - Arrangement` |
| 113000 Accounts Receivable | `Fee receivable - Commitment` |
| 113000 Accounts Receivable | `Fee receivable - Guarantee` |
| 113000 Accounts Receivable | `Fee receivable - Management` |
| 113000 Accounts Receivable | `Fee receivable - Dividend (Equity)` |
| 113000 Accounts Receivable | `Fee received - Arrangement` *(cash-settlement clear)* |
| 113000 Accounts Receivable | `Fee received - Commitment` *(cash-settlement clear)* |
| 113000 Accounts Receivable | `Fee received - Guarantee` *(cash-settlement clear)* |
| 113000 Accounts Receivable | `Fee received - Management` *(cash-settlement clear)* |
| 113000 Accounts Receivable | `Fee received - Dividend` *(cash-settlement clear)* |

(Existing `Interest receivable` / `Interest received` work cleanly for interest — only fees need new transaction types.)

---

### Gap #3 — IFRS 9 ECL impairment expense

| Currently posts to | Investran account | Investran transaction type |
|---|---|---|
| `519000 Investment Expenses - Other` | 519000 | `Expense - Investment Expenses - Other` (proxy) |

**Affected JE labels:**
- `Impairment Expense (ECL)` — Libra 2, Libra 3, Volt — total **£170K** over the loans' lives

**Recommendation — create new GL account:**

| New Account | Recommended name |
|---|---|
| **470000** | Impairment / ECL Expense (IFRS 9 §5.5) |

**Strongly recommended.** Putting impairment in a separate account from "investment expenses other" is needed for IFRS 9 §5.5 expected credit loss disclosure.

---

### Gap #4 — IFRS 9 ECL loan loss allowance (contra-asset)

| Currently posts to | Investran account | Investran transaction type |
|---|---|---|
| `141000 Investments at Cost` | 141000 | (no clean transtype — currently a placeholder) |

**Affected JE labels:**
- `Loan Loss Allowance (Contra-Asset)` — Libra 2, Libra 3, Volt — total **£170K**

**Recommendation — create new GL account:**

| New Account | Recommended name |
|---|---|
| **145000** | Loan Loss Allowance — IFRS 9 ECL (contra under 141000) |

**Strongly recommended.** This is the contra-asset that the impairment expense above credits to. Without it, the loan asset balance is wrong on the balance sheet because the allowance is netting through 141000 itself.

---

### Gap #5 — Hedge accounting: hedging instrument fair value

| Currently posts to | Investran account |
|---|---|
| `141000 Investments at Cost` (placeholder) |

**Affected JE labels:**
- `Hedging Instrument MTM` (FVH and CFH ineffective portion legs)
- `Hedging Instrument MTM (CFH OCI)` (CFH effective portion legs)

**Affected instruments:** Libra 3 (only seed instrument with a hedge).

**Recommendation — create new GL account:**

| New Account | Recommended name |
|---|---|
| **146000** | Derivative Assets / Liabilities (hedging instruments) |

This is where the IRS / cap / collar fair value lives on the balance sheet. Lumping it into 141000 Investments at Cost mixes loan exposures with hedging derivatives.

---

### Gap #6 — Hedge accounting: Cash Flow Hedge Reserve (OCI)

| Currently posts to | Investran account |
|---|---|
| `351000 Retained Earnings` (placeholder) |

**Affected JE labels:**
- `Cash Flow Hedge Reserve (OCI)` (effective portion accumulation)
- `Cash Flow Hedge Reserve Reclass` (settlement reclassification to P&L)

**Affected instruments:** Libra 3.

**Recommendation — create new GL account:**

| New Account | Recommended name |
|---|---|
| **360000** | Cash Flow Hedge Reserve (OCI) |

**Strongly recommended.** This is a separate equity component per IFRS 9 §6.5.11. Putting CFH OCI movements through retained earnings is wrong — they need to sit in OCI until reclassification to P&L on settlement, and the equity statement must show the movement separately.

---

### Gap #7 — Hedge accounting: ineffectiveness / FV hedge P&L

| Currently posts to | Investran account |
|---|---|
| `450000 Unrealized Gain/Loss` (proxy) |

**Affected JE labels:**
- `Hedge Ineffectiveness P&L` — IFRS 9 §6.5.10 (CFH ineffective portion)
- `Fair Value Hedge P&L` — IFRS 9 §6.5.8 (FVH full MTM)

**Affected instruments:** Libra 3 (and any FVH instrument added later).

**Recommendation — create new GL accounts:**

| New Account | Recommended name |
|---|---|
| **451000** | Hedge Ineffectiveness P&L (IFRS 9 §6.5.10) |
| **452000** | Fair Value Hedge P&L (IFRS 9 §6.5.8) |

These are typically required for IFRS 9 §6.6.4 hedge accounting disclosure (effectiveness ratio + ineffectiveness in P&L). You can keep them in 450000 if disclosure runs separately, but a clean account makes audit trail simpler.

---

### Gap #8 — Non-use fee income (chart only has expense side at 523000)

| Currently posts to | Investran account |
|---|---|
| `492000 Other Income - Amendments` (proxy) |

**Affected JE labels:**
- `Non-Use Fee Income` — Northwind RCF — **£491K**
- `Non-Use Fee Receivable` + clear

**Recommendation — add new transaction types under 492000 (or under whichever fee-income account you create from Gap #1):**

| Account | New transaction type |
|---|---|
| 492000 | `Non-use fee income (lender)` |
| 113000 | `Non-use fee receivable` |
| 113000 | `Non-use fee received` |

The Investran chart already has "Expense - Financing costs - Unused line fees" at 523000 — that's the **borrower's** expense for keeping a facility undrawn. NWF, as the **lender** receiving the fee, needs the income side.

---

### Gap #9 — IFRS 9 §5.4.3 modification gain/loss

| Currently posts to | Investran account |
|---|---|
| `440000 Realized Gain/Loss` (proxy) |

**Affected JE labels:** `Modification Gain (IFRS 9)` / `Modification Loss (IFRS 9)`

**Affected instruments:** none in the seed dataset — this is data-driven (any instrument with a `modificationEvents[]` block triggers it; the mechanism is in place and works as soon as a covenant amendment / re-pricing is recorded).

**Recommendation — create new GL account (nice-to-have):**

| New Account | Recommended name |
|---|---|
| **442000** | Modification Gain/Loss (IFRS 9 §5.4.3) |

Useful when distressed-asset modifications start happening regularly. For now it lives in 440000 Realized Gain/Loss alongside disposal P&L, which works but mixes derecognition gain with modification gain.

---

### Gap #10 — Default interest / default fee income

| Currently posts to | Investran account |
|---|---|
| `421000 Investment Interest Income` and `492000 Other Income - Amendments` (proxies) |

**Affected JE labels:** `Default Interest Income`, `Default Fee Income`

**Affected instruments:** none in the seed dataset — data-driven via `defaultEvents[]` on any instrument.

**Recommendation — add new transaction types (no new accounts needed):**

| Account | New transaction type |
|---|---|
| 421000 Investment Interest Income | `Default interest income (penalty rate)` |
| 113000 Accounts Receivable | `Default interest receivable` |
| 113000 Accounts Receivable | `Default interest received` |
| 492000 Other Income - Amendments | `Default fee income` |

Default interest and default fees are typically disclosed separately for credit risk reporting (especially Stage 2/3 exposures). Reusing existing accounts is fine, just need the transaction types so reports can split them out.

---

## What's already clean (no action needed)

The following calculator concepts map cleanly to existing Investran accounts and transaction types — no changes required:

| Calculator concept | Investran account | Investran transaction type |
|---|---|---|
| Interest receivable | 113000 Accounts Receivable | Interest receivable |
| Interest received (cash settlement) | 113000 Accounts Receivable | Interest received |
| Interest income (accrued) | 421000 Investment Interest Income | Income - Investment interest - Accrued |
| Interest income (cash) | 421000 Investment Interest Income | Income - Investment interest - Cash |
| Interest income (PIK / accreted) | 421000 Investment Interest Income | Income - Investment interest - PIK/Accreted |
| Cash received (drawdown / payment receipts) | 111000 Cash | Cash received |
| Cash disbursed (repayments) | 111000 Cash | Cash disbursed |
| Loan asset (initial drawdown) | 141000 Investments at Cost | Purchase of investment - Notes - initial drawdown |
| Loan asset (additional drawdown) | 141000 Investments at Cost | Purchase of investment - Notes - additional drawdown |
| Loan repayment / return of capital | 141000 Investments at Cost | Sale of investment - Notes - Return of capital |
| PIK capitalisation | 141000 Investments at Cost | Purchase of investment - Notes - principal from capitalization |
| OID / discount accretion | 141000 Investments at Cost | Investment accretion - Original issue discount |
| PIK accretion | 141000 Investments at Cost | Investment accretion - PIK interest |
| FX revaluation (unrealised) | 450000 Unrealized Gain/Loss | Unrealized gain/(loss) - F/X gain/(loss) |
| FX revaluation (realised) | 440000 Realized Gain/Loss | Realized gain/(loss) - Short term - F/X |
| Withholding tax receivable | 113000 Accounts Receivable | Withholding tax receivable |
| Withholding tax received | 113000 Accounts Receivable | Withholding tax received |

---

## Per-instrument gap breakdown

### Instruments with **zero** gaps
- **Alliance Manufacturing Convertible Note** (alliance)
- **Copperleaf 8% Senior Notes 2030** (discountBond)
- **Orion Term Loan B — FCP-II £40m** (floatingLoan)
- **Orion Term Loan B — FCP-I £20m secondary** (floatingLoanFCP1)
- **Meridian Unitranche** (privateCredit)
- **Suffolk Solar Multi-Tranche** (suffolkMultiTranche)

These are vanilla loan structures — interest accrual, PIK, OID, drawdowns, repayments — all map to existing Investran accounts. No new accounts required.

### Instruments with gaps

| Instrument | Gaps | Categories |
|---|:-:|---|
| **Northwind RCF** | 3 | Non-use fee income (#8) — needs `Non-use fee income` transaction type and `Non-use fee receivable / received` |
| **Libra 2 — HSBC Facility B4** | 8 | IFRS 15 fee income (#1) for arrangement + commitment fee · IFRS 15 fee receivables (#2) · ECL impairment + allowance (#3, #4) |
| **Libra 3 — same as Libra 2 + CFH** | 14 (8 same as Libra 2 + 6 hedge) | Same as Libra 2 PLUS hedge accounting (#5, #6, #7): derivatives asset, CFH reserve OCI, hedge ineffectiveness P&L |
| **Volt Financial Guarantee** | 8 | IFRS 15 fee income for guarantee + NWF commitment fee + arrangement (#1, #2) · ECL impairment + allowance (#3, #4) |
| **Volt Multi-Loan Guarantee** | 6 | IFRS 15 fee income for arrangement + guarantee (#1, #2) |
| **XYZ Buyout Fund LP** | 6 | IFRS 15 fee income for management fee Y1-5 + Y5+ (#1, #2). FVTPL equity — no ECL needed |
| **ABCDEF Series C** | 9 | IFRS 15 dividend income (point-in-time) for FY27 / FY28 / FY30 (#1, #2). FVTPL equity |

---

## Action plan for your Investran administrator

**Priority 1 (must-have for IFRS 9 / IFRS 15 compliance):**

1. Create **470000 Impairment / ECL Expense (IFRS 9 §5.5)**
2. Create **145000 Loan Loss Allowance** (contra-asset under 141000)
3. Create **360000 Cash Flow Hedge Reserve (OCI)** (separate equity component)
4. Create **146000 Derivative Assets / Liabilities** (hedging instruments)
5. Add transaction type **"Fee receivable (IFRS 15)"** under 113000 Accounts Receivable
6. Add transaction type **"Fee received (IFRS 15)"** under 113000 Accounts Receivable

**Priority 2 (recommended for clean reporting):**

7. Create **451000 Hedge Ineffectiveness P&L** and **452000 Fair Value Hedge P&L**
8. Create **442000 Modification Gain/Loss** (IFRS 9 §5.4.3)
9. Create separate fee-income accounts (or transtypes) for:
   - **492100 Arrangement Fee Income**
   - **492200 Commitment Fee Income**
   - **492300 Guarantee Fee Income**
   - **492400 Management Fee Income**
   - **492500 Dividend Income (Equity)**

**Priority 3 (nice-to-have transaction types):**

10. Add transaction type **"Non-use fee income"** under 492000 (currently only borrower-side at 523000)
11. Add transaction type **"Default interest income"** under 421000 Investment Interest Income
12. Add transaction type **"Default fee income"** under 492000 Other Income - Amendments

---

## How to update the calculator after Investran creates these

In `income-calculator.html`, find the `INVESTRAN_GL` constant (around line ~1985). For each gap, change the entry's `account` and `transType` to the newly-created Investran codes and remove the `gap: true` flag. The DIU export will automatically pick up the new codes and the GL Coverage panel will turn green.

Example — once 470000 is created:

```js
impairmentExpense: { account:'470000', accountName:'Impairment / ECL Expense (IFRS 9 §5.5)', transType:'Expense - IFRS 9 ECL' },
//                                                                                              ↑ remove gap:true and gapNote
```

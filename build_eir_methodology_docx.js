#!/usr/bin/env node
/* ===========================================================================
   build_eir_methodology_docx.js — EIR calculation methodology document for
   accountants reviewing the Loan Module Integration Layer.

   Output: EIR-Calculation-Methodology.docx

   Reviewer audience: financial-control / fund-accounting / audit teams.
   Sections cover IFRS 9 §B5.4 scope, the math, the engine's four calculation
   paths, daily mechanics, three worked examples, modification accounting,
   audit trail evidence, and a glossary.

   Run:
     npm install -g docx
     node build_eir_methodology_docx.js
=========================================================================== */

const fs = require('fs');
const path = require('path');

// Resolve docx from the standard global install path if NODE_PATH isn't set
let docxLib;
try { docxLib = require('docx'); }
catch (e) {
  // Try common global install locations
  const candidates = [
    '/usr/local/lib/node_modules/docx',
    '/usr/local/lib/node_modules_global/lib/node_modules/docx',
    process.env.HOME + '/.npm-global/lib/node_modules/docx'
  ];
  for (const c of candidates) {
    try { docxLib = require(c); break; } catch (e2) {}
  }
  if (!docxLib) { console.error('docx not found. Install with: npm install -g docx'); process.exit(1); }
}
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak, TabStopType, TabStopPosition,
  TableOfContents, ExternalHyperlink
} = docxLib;

// ─── PALETTE ────────────────────────────────────────────────────────────────
const NAVY  = '21295C';
const TEAL  = '1C7293';
const SLATE = '5A6478';
const INK   = '1A1F36';
const RULE  = 'D4DAE3';
const BAND  = 'F5F8FB';
const CARD  = 'EEF6FA';
const FORMULA_BG = 'FFF8E1';
const AMBER = 'F4A261';
const WHITE = 'FFFFFF';

// ─── HELPERS ────────────────────────────────────────────────────────────────
function P(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before || 0, after: opts.after || 120 },
    alignment: opts.align || AlignmentType.LEFT,
    children: [new TextRun({
      text,
      bold: opts.bold || false,
      italics: opts.italics || false,
      size: opts.size || 22,
      color: opts.color || INK,
      font: opts.font || 'Arial'
    })]
  });
}
function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: NAVY, font: 'Arial' })]
  });
}
function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: NAVY, font: 'Arial' })]
  });
}
function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, color: TEAL, font: 'Arial' })]
  });
}
function bodyRuns(runs, opts = {}) {
  return new Paragraph({
    spacing: { before: 0, after: opts.after || 120 },
    alignment: opts.align || AlignmentType.LEFT,
    children: runs
  });
}
function run(text, opts = {}) {
  return new TextRun({
    text,
    bold: opts.bold || false,
    italics: opts.italics || false,
    size: opts.size || 22,
    color: opts.color || INK,
    font: opts.font || 'Arial'
  });
}
function bullet(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text, size: opts.size || 22, color: INK, font: 'Arial' })]
  });
}
function spacer(after) { return new Paragraph({ spacing: { before: 0, after: after || 80 }, children: [] }); }

// Code-style monospace paragraph (for formulas)
function codeP(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    shading: { type: ShadingType.CLEAR, fill: opts.bg || FORMULA_BG },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: opts.border || AMBER, space: 8 } },
    children: [new TextRun({ text, font: 'Consolas', size: 20, color: NAVY })]
  });
}

// Cell helpers
function thinBorder() {
  const t = { style: BorderStyle.SINGLE, size: 4, color: RULE };
  return { top: t, bottom: t, left: t, right: t };
}
function headerCell(text, width) {
  return new TableCell({
    borders: thinBorder(),
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: NAVY },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text, bold: true, color: WHITE, size: 20, font: 'Arial' })]
    })]
  });
}
function dataCell(text, width, opts = {}) {
  return new TableCell({
    borders: thinBorder(),
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({
        text: text == null ? '' : String(text),
        bold: opts.bold || false,
        color: opts.color || INK, size: 20, font: 'Arial'
      })]
    })]
  });
}
function buildTable(headers, rows, colWidths) {
  const total = colWidths.reduce((s, w) => s + w, 0);
  const headerRow = new TableRow({
    children: headers.map((h, i) => headerCell(h, colWidths[i]))
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, i) => {
      const opts = (typeof cell === 'object' && !Array.isArray(cell) && cell !== null && cell.text != null)
        ? { align: cell.align, bold: cell.bold, color: cell.color, fill: ri % 2 === 0 ? BAND : undefined }
        : { fill: ri % 2 === 0 ? BAND : undefined };
      const text = (typeof cell === 'object' && cell !== null && cell.text != null) ? cell.text : cell;
      return dataCell(text, colWidths[i], opts);
    })
  }));
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows]
  });
}

// Callout box (single-row table with coloured left border)
function callout(label, body, color) {
  color = color || TEAL;
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: {
          top: { style: BorderStyle.NONE, size: 0 },
          right: { style: BorderStyle.NONE, size: 0 },
          bottom: { style: BorderStyle.NONE, size: 0 },
          left: { style: BorderStyle.SINGLE, size: 24, color }
        },
        width: { size: 9360, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: CARD },
        margins: { top: 120, bottom: 120, left: 200, right: 160 },
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: label.toUpperCase(), bold: true, color, size: 18, font: 'Arial' })]
          }),
          ...body.map(b => typeof b === 'string'
            ? new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: b, size: 21, color: INK, font: 'Arial' })] })
            : b
          )
        ]
      })]
    })]
  });
}

// JE pair table (DR / CR layout)
function jeTable(rows, currency) {
  const colW = [1200, 4200, 2080, 1880];   // Account | Description | DR | CR
  return buildTable(
    ['Account', 'Description', 'DR (' + currency + ')', 'CR (' + currency + ')'],
    rows,
    colW
  );
}

// ─── DOCUMENT CONTENT ───────────────────────────────────────────────────────
const children = [];

// ── Header / banner ────────────────────────────────────────────────────────
children.push(
  new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: 'NWF / FIS CAPITAL PARTNERS  ·  LOAN MODULE INTEGRATION LAYER', bold: true, size: 16, color: SLATE, font: 'Arial' })]
  }),
  new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: 'EIR Calculation Methodology', bold: true, size: 44, color: NAVY, font: 'Arial' })]
  }),
  new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: 'IFRS 9 §B5.4 — how Effective Interest Rate is computed by the engine, applied to journals, and evidenced for audit', italics: true, size: 22, color: SLATE, font: 'Arial' })]
  })
);

// Doc control table
children.push(
  buildTable(
    ['Field', 'Value'],
    [
      ['Document', 'EIR Calculation Methodology'],
      ['Version', '2026-05-11'],
      ['Owner', 'Loan Module Integration Layer team'],
      ['Reviewers', 'Financial Control · Internal Audit · External Audit'],
      ['Subject', 'IFRS 9 §B5.4 EIR computation in the engine (loan-module-engine.js)'],
      ['Status', 'Final · ready for review'],
    ],
    [2200, 7160]
  )
);
children.push(spacer(240));

// Executive summary
children.push(H1('1.  Executive summary'));
children.push(P(
  'IFRS 9 §B5.4 requires every financial asset measured at amortised cost to recognise interest income using the Effective Interest Rate (EIR) — the rate that exactly discounts all estimated future cash receipts (drawdowns, repayments, and fees that are part of the EIR) to the gross carrying amount at recognition. The Loan Module Integration Layer computes EIR in one place — the shared engine in loan-module-engine.js — and uses it consistently across every downstream IFRS calculation: daily interest accrual, deferred-fee accretion, carrying-value waterfall, ECL discounting, and modification gain/loss.'
));
children.push(P(
  'The engine has four calculation paths, selected automatically based on the instrument\'s shape:'
));
children.push(bullet('Bilateral fixed-rate — bisection solve over a contractual cashflow set including EIR-included fees.'));
children.push(bullet('Floating-rate / RFR — compositional construction (rfr.baseRate + marginSchedule[t].marginBps), no bisection, period-by-period.'));
children.push(bullet('Multi-tranche / multi-underlying — recurse into each child, solve per child, face-weighted aggregate at deal level.'));
children.push(bullet('Modification re-derivation under §5.4.3 — substantial modifications trigger derecognition + recognition with a new EIR; non-substantial modifications retain the original EIR.'));
children.push(P(
  'EIR is locked at initial recognition and used for the life of the asset, except where a substantial modification or an SPPI failure forces re-recognition. The engine\'s output is auditable: the Evidence Pack panel "EIR Calculation Trace" reproduces the exact cashflows, NPV equation, bisection iterations, and resulting EIR for the currently loaded deal.'
));

// 2. The IFRS basis
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('2.  IFRS 9 §B5.4 — what EIR is, and why we calculate it'));

children.push(H2('2.1  Definition'));
children.push(P(
  'IFRS 9 Appendix A defines the Effective Interest Rate as "the rate that exactly discounts estimated future cash payments or receipts through the expected life of the financial asset to the gross carrying amount of a financial asset." In practice, EIR is the internal rate of return computed over a contractually-defined cashflow set, with the carrying value at recognition as the implicit day-0 amount.'
));
children.push(H2('2.2  Why it matters'));
children.push(P(
  'Without EIR, interest income would be the simple coupon × principal × time. That ignores upfront fees, original-issue discounts, and premiums — all of which represent economic yield to the lender. IFRS 9 §B5.4 forces a single blended rate that spreads those amounts evenly over the expected life of the asset. The result: a smoother interest-income profile that reflects true economic yield, and a balance-sheet carrying value that converges to face value at maturity.'
));
children.push(P(
  'Three numbers that look similar but differ:'
));
children.push(bullet('Coupon rate — the contractual rate printed on the loan agreement.'));
children.push(bullet('Cash yield — annual coupon ÷ price paid at recognition.'));
children.push(bullet('EIR (effective yield) — the IRR over the contractual cashflow set, including EIR-included fees. This is what IFRS 9 requires for interest income recognition.'));

children.push(H2('2.3  When EIR is re-derived'));
children.push(P(
  'IFRS 9 locks EIR at initial recognition. Three events can re-derive it:'
));
children.push(bullet('Substantial modification (§5.4.3) — the modified PV at the original EIR differs from the carrying amount by more than the substantial threshold (default 10%). Derecognise old asset, recognise new asset, solve new EIR.'));
children.push(bullet('SPPI failure mid-life — the instrument is reclassified to FVTPL. EIR no longer drives interest recognition; coupon goes through P&L at FV change.'));
children.push(bullet('Reclassification triggered by a change in business model — rare in practice; treated like a substantial modification for EIR purposes.'));

// 3. Scope
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('3.  Scope — what feeds the EIR calculation'));

children.push(H2('3.1  Cashflows INCLUDED'));
children.push(buildTable(
  ['Cashflow type', 'Sign', 'Source field', 'IFRS reference'],
  [
    ['Initial drawdown',           'Outflow', 'principalSchedule[].amount (negative)', '§B5.4.1'],
    ['Scheduled principal repayments','Inflow','principalSchedule[] / accrualSchedule[].paydown','§B5.4.1'],
    ['Contractual coupon receipts','Inflow', 'computed from coupon.fixedRate or RFR + margin','§B5.4.1'],
    ['EIR-included fees (arrangement, origination, upfront)','Inflow','fees[] where ifrs = "IFRS9-EIR"','§B5.4.1'],
    ['Premium / discount on purchase','Outflow / inflow','purchasePrice vs faceValue','§B5.4.1'],
    ['Final balloon (face + final coupon)','Inflow','accrualSchedule[last]','§B5.4.1'],
  ],
  [2400, 1200, 3360, 2400]
));

children.push(H2('3.2  Cashflows EXCLUDED'));
children.push(buildTable(
  ['Cashflow type', 'Why excluded', 'Where it goes instead'],
  [
    ['Servicing fees',                 'Compensation for services, not yield','IFRS 15 — separate recognition'],
    ['Commitment fees on undrawn',     'Not certain to be received',          'IFRS 15 over-time on undrawn balance'],
    ['Non-use fees',                   'Pricing for unused capacity',         'IFRS 15 over-time on undrawn balance'],
    ['Reimbursements (legal, transaction)','Pass-through, no yield component',  'P&L on receipt'],
    ['Withholding tax',                'Not lender\'s revenue',               'Tax recoverable / not-recoverable line'],
    ['Modification gain/loss',         'Periodic event, not in EIR base',     'Account 442000 Modification G/L'],
  ],
  [2400, 3360, 3600]
));
children.push(callout('Audit note', [
  'A common review question is "why is the commitment fee not in EIR?" The answer is IFRS 15 §B40 — fees that compensate the lender for keeping a facility available, when no draw has occurred, are not part of the financial asset\'s yield. They\'re a separate performance obligation recognised over time. When the facility is drawn, the commitment fee status changes and the engine routes accordingly.'
]));

// 4. The math
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('4.  The calculation in plain math'));

children.push(H2('4.1  The NPV equation'));
children.push(P(
  'EIR is the rate r that satisfies the NPV equation across all contractual cashflows:'
));
children.push(codeP('0  =  Σ_{t=0..N}  CF_t / (1 + r)^t'));
children.push(P('Where:'));
children.push(bullet('CF_t is the cashflow at time t (sign convention: outflows negative, inflows positive).'));
children.push(bullet('t is years from settlement, computed from the day-count basis (ACT/365 → t = days/365, etc.).'));
children.push(bullet('N is the last cashflow date — final coupon + principal repayment.'));
children.push(bullet('r is the unknown: the rate that makes the equation balance.'));
children.push(P(
  'CF_0 is the net day-1 outflow: principal disbursed minus any EIR-included fees received on the same day. For a £1m loan with a £20k arrangement fee paid by the borrower at signing, CF_0 = -£980,000.'
));

children.push(H2('4.2  The bisection solver'));
children.push(P(
  'The engine solves for r using bisection (Wikipedia: Bisection method) — a deterministic, no-derivatives required, guaranteed-to-converge numerical method. The algorithm:'
));
children.push(buildTable(
  ['Step', 'Action'],
  [
    ['1', 'Set initial bracket: lo = -0.99, hi = +5.00'],
    ['2', 'Compute NPV at lo and hi. If they have the same sign, no root exists — return null.'],
    ['3', 'mid = (lo + hi) / 2 · compute NPV(mid)'],
    ['4', 'If |NPV(mid)| < tolerance (1e-6 → £0.01 on a £10m deal), accept mid as the EIR and stop.'],
    ['5', 'Otherwise: replace whichever endpoint has the same sign as NPV(mid) with mid · go to step 3.'],
    ['6', 'Cap at 80 iterations to prevent runaway. Returns the midpoint of the final bracket if 80 iterations don\'t converge.'],
  ],
  [1000, 8360]
));
children.push(P(
  'In practice every deal in the seed dataset converges in 30-40 iterations. The bracket [-0.99, +5.00] covers any realistic loan yield (-99% to +500%); a real-world EIR is always between zero and ~20%.'
));

children.push(H2('4.3  Why bisection (not Newton-Raphson)'));
children.push(P(
  'Newton-Raphson is faster (quadratic convergence vs bisection\'s linear) but requires a derivative and can fail to converge on multi-modal NPV functions. Bisection is slower per iteration but guaranteed to converge if the initial bracket contains a sign change. For a 50ms-per-deal cost we get robustness — which matters for audit. The engine has historically run Newton-Raphson on equity-style instruments and seen non-convergence on degenerate cashflow profiles; bisection eliminates that class of failure.'
));

// 5. Four calculation paths
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('5.  The four calculation paths in the engine'));

children.push(H2('5.1  Path 1 — Bilateral fixed-rate (bisection solve)'));
children.push(P(
  'Trigger: instrument has coupon.type = "Fixed" and no tranches[] / no underlyingLoans[] / no rfr.baseRate. Example: Aurora Senior tranche (in isolation), Alliance Manufacturing, Copperleaf Capital.'
));
children.push(P('The engine builds the cashflow set:'));
children.push(bullet('t = 0: net day-1 outflow = -(faceValue - upfrontEirFees)'));
children.push(bullet('t = 1..N-1: annual coupon = faceValue × coupon.fixedRate'));
children.push(bullet('t = N: faceValue × (1 + coupon.fixedRate) — final coupon plus principal'));
children.push(P('Bisection solves for r. The resulting r is the EIR. Stored on the run; consumed by every downstream IFRS calculation.'));

children.push(H2('5.2  Path 2 — Floating-rate / RFR (compositional construction)'));
children.push(P(
  'Trigger: instrument.rfr is non-null, or coupon.type is in {SONIA, SOFR, ESTR, EURIBOR, TONA, FED}. Example: Helios Solar Bridge, Libra 2, Libra 3, Suffolk Solar tranche B.'
));
children.push(P(
  'For floating-rate deals the rate resets every period (typically quarterly), so a single fixed EIR would be meaningless. The engine does not bisection-solve. Instead it constructs EIR period-by-period:'
));
children.push(codeP('EIR_t  =  rfr.baseRate_t  +  marginSchedule[t].marginBps / 10000  (+ esgAdjustment)'));
children.push(P(
  'For each calendar day, the engine reads the active SONIA reset (or SOFR, etc.) from rfr.baseRate (or rfr.rateSchedule[t] in a production deployment), reads the active margin from marginSchedule[] for the date, and uses EIR_t to compute the daily interest accrual. There is no single EIR to lock in — the schedule of period EIRs IS the locked rate set.'
));
children.push(callout('Critical reviewer point', [
  'For an RFR deal, the "EIR" displayed at the deal level in Stage 2 is the CURRENT-PERIOD EIR. The carrying value accretion uses period-specific EIRs over time. This is the IFRS 9-compliant treatment for daily-reset floating rates. If a substantial modification occurs mid-life (e.g. margin schedule is materially changed), §5.4.3 still applies — derecognise and recognise a new schedule from the modification date forward.'
]));

children.push(H2('5.3  Path 3 — Multi-tranche / multi-underlying'));
children.push(P(
  'Trigger: instrument.tranches[] is non-empty (multi-tranche loan), or instrument.underlyingLoans[] is non-empty (multi-underlying guarantee). Example: Aurora Renewables (tranches), Suffolk Solar Phase 2 (tranches), Volt Multi-Loan (underlyings).'
));
children.push(P(
  'The engine recurses into each child object. Each child is treated as if it were a standalone instrument, with its own coupon (fixed or RFR), own cashflow set, own EIR. The deal-level EIR is the face-weighted aggregate of the per-child EIRs:'
));
children.push(codeP('Deal EIR  =  Σ (face_i × EIR_i) / Σ face_i'));
children.push(P(
  'Importantly, journals still post against each child\'s carrying value using the child\'s own EIR. The deal-level aggregate is for headline display and sub-ledger reconciliation only. This is how the engine implements "EIR is calculated at the lowest cashflow-bearing unit" — the principle that solving a single EIR across blended cashflows of different risk/return profiles would distort the IFRS 9 §B5.4 yield-spreading mechanism.'
));

children.push(H2('5.4  Path 4 — Modification under §5.4.3'));
children.push(P(
  'When a deal modification event is recorded (modificationEvents[] non-empty), the engine runs the substantial test:'
));
children.push(codeP('|PV_new(orig_EIR) − Carrying_old|  /  Carrying_old  ≥  10%   ⇒  Substantial'));
children.push(P(
  'The 10% threshold is configurable in the Treatment panel. PV_new is the present value of the modified cashflows discounted at the original EIR. Two outcomes:'
));
children.push(bullet('Substantial: derecognise old asset (post Carrying_old to 141000 CR, gain/loss to 442000), recognise new asset at fair value, re-derive EIR from modification date forward using the modified cashflows.'));
children.push(bullet('Non-substantial: adjust carrying value to PV_new (DR/CR delta to 141000, gain/loss to 442000), retain original EIR.'));

// 6. From EIR to journals
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('6.  From EIR to journals — daily mechanics'));

children.push(H2('6.1  Daily interest accrual'));
children.push(P(
  'On every calendar day in the schedule, the engine computes:'
));
children.push(codeP('dailyInterest  =  balance × EIR × dayCountFactor(basis, date)'));
children.push(P('Where dayCountFactor is 1/365 for ACT/365, 1/360 for ACT/360, 1/daysInYear(date) for ACT/ACT, etc.'));
children.push(P('The accrual is split into:'));
children.push(bullet('Cash interest at coupon rate (paid out on coupon dates per the cashflow schedule).'));
children.push(bullet('EIR accretion (the difference between EIR × balance and coupon × balance) — accreted into carrying value rather than paid in cash, until the deferred fee at recognition is fully unwound.'));

children.push(H2('6.2  EIR accretion of deferred fees'));
children.push(P(
  'When an EIR-included arrangement fee is received at recognition, IFRS 9 §B5.4 requires it to be held as a contra-asset and accreted into income over the deal\'s life via EIR. The engine implements this via:'
));
children.push(codeP('dailyEIRAccretion  =  (EIR − coupon) × balance × dayCountFactor'));
children.push(P('Over the deal\'s life, the cumulative accretion equals the upfront fee. By maturity the contra-asset is zero.'));

children.push(H2('6.3  Sample journal entries (per day, for an EIR-fee-bearing bilateral)'));
children.push(P('Day 1 (recognition):'));
children.push(jeTable([
  ['141000', 'Loan asset recognised at face value', '80,000,000', ''],
  ['111000', 'Cash disbursed', '', '79,600,000'],
  ['111000', 'Cash received — arrangement fee', '400,000', ''],
  ['141000', 'Deferred fee booked into carrying as contra-asset', '', '400,000'],
], 'GBP'));
children.push(P('Each day during life:'));
children.push(jeTable([
  ['113000', 'Interest receivable (cash interest at coupon)', '12,602', ''],
  ['421000', 'Interest income — coupon portion', '', '12,602'],
  ['141000', 'Carrying value accretion (EIR fee unwind)', '230', ''],
  ['421000', 'Interest income — EIR accretion portion', '', '230'],
], 'GBP'));
children.push(P('On coupon date:'));
children.push(jeTable([
  ['111000', 'Cash received — coupon settlement', '1,150,000', ''],
  ['113000', 'Clear interest receivable accrued for the period', '', '1,150,000'],
], 'GBP'));

children.push(H2('6.4  Carrying value reconciliation'));
children.push(P(
  'At any point, carrying value reconciles to the IAS 1 §54 movement waterfall. The Evidence Pack panel "Carrying Value Waterfall" surfaces this:'
));
children.push(codeP(
  'Closing carrying  =  Opening carrying\n'
  + '                  + Drawdowns − Repayments\n'
  + '                  + EIR Accretion (daily)\n'
  + '                  + OID Amortisation\n'
  + '                  + PIK Capitalised\n'
  + '                  ± Modification gain / loss\n'
  + '                  ± Hedge P&L\n'
  + '                  ± FX Revaluation\n'
  + '\nMemo: less ECL allowance (presented as contra-asset per §5.5)'));

// 7. Worked example 1 — Aurora Senior
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('7.  Worked example 1 — Aurora Senior (fixed-rate with EIR-included fee)'));

children.push(H2('7.1  Deal facts'));
children.push(buildTable(
  ['Attribute', 'Value'],
  [
    ['Instrument', 'Aurora Renewables Phase 1 — Senior tranche'],
    ['Legal entity', 'NWF Sustainable Infrastructure'],
    ['Face value', 'GBP 80,000,000'],
    ['Coupon', '5.7500% fixed annual'],
    ['Day count basis', '30/360'],
    ['Term', '2026-03-01 → 2031-03-01 (5-year bullet)'],
    ['Arrangement fee', 'GBP 400,000 paid upfront (EIR-included per §B5.4)'],
    ['IFRS 9 classification', 'AmortisedCost · SPPI passed · HoldToCollect'],
  ],
  [2400, 6960]
));

children.push(H2('7.2  Cashflow set fed to the bisection solver'));
children.push(buildTable(
  ['t (years)', 'Cashflow (GBP)', 'Description'],
  [
    ['0',  '-79,600,000', 'Disburse £80m, receive £400k arrangement fee. Net outflow.'],
    ['1',   '4,600,000',  'Coupon 5.75% × £80m'],
    ['2',   '4,600,000',  'Coupon'],
    ['3',   '4,600,000',  'Coupon'],
    ['4',   '4,600,000',  'Coupon'],
    ['5',  '84,600,000',  'Final coupon + principal repayment'],
  ],
  [1400, 2400, 5560]
));

children.push(H2('7.3  NPV equation'));
children.push(codeP(
  '0 = -79,600,000 + 4,600,000/(1+r)^1 + 4,600,000/(1+r)^2 + 4,600,000/(1+r)^3 + 4,600,000/(1+r)^4 + 84,600,000/(1+r)^5'
));

children.push(H2('7.4  Bisection result'));
children.push(P('Converged after 36 iterations. Tolerance 1e-6 (~£0.01 on £80m).'));
children.push(buildTable(
  ['Output', 'Value'],
  [
    ['EIR', '5.8683%'],
    ['Headline coupon', '5.7500%'],
    ['Spread between EIR and coupon', '+11.8 bps (from £400k EIR-included fee)'],
    ['Cumulative EIR accretion over life', '£400,000 (matches the upfront fee — by maturity the contra-asset is zero)'],
  ],
  [3000, 6360]
));
children.push(callout('Reviewer verification', [
  'A reviewer can verify this calculation by computing NPV at r = 5.8683% in Excel:',
  'NPV(5.8683%, [4.6M, 4.6M, 4.6M, 4.6M, 84.6M]) = 79,600,000.',
  'Equivalently: solve =IRR(-79.6M, 4.6M, 4.6M, 4.6M, 4.6M, 84.6M) and confirm 5.8683%.'
]));

// 8. Worked example 2 — Helios floating
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('8.  Worked example 2 — Helios Solar Bridge (RFR floating-rate)'));

children.push(H2('8.1  Deal facts'));
children.push(buildTable(
  ['Attribute', 'Value'],
  [
    ['Instrument', 'Helios Solar Bridge'],
    ['Face value', 'GBP 30,000,000 · 5-year bullet'],
    ['Reference rate', 'Compounded SONIA (current illustrative reset: 4.7500%)'],
    ['Margin schedule', '275 bps (Yrs 1-2) → 300 bps (Yrs 3-4) → 325 bps (Yr 5)'],
    ['Day count basis', 'ACT/365'],
    ['IFRS 9 classification', 'AmortisedCost · SPPI passed · HoldToCollect'],
  ],
  [2400, 6960]
));

children.push(H2('8.2  Period EIR construction'));
children.push(buildTable(
  ['#', 'From', 'To', 'SONIA', 'Margin', 'EIR for period'],
  [
    ['1', '2026-04-15', '2028-04-14', '4.7500%', '2.7500% (275 bps)', '7.5000%'],
    ['2', '2028-04-15', '2030-04-14', '4.7500%', '3.0000% (300 bps)', '7.7500%'],
    ['3', '2030-04-15', '2031-04-15', '4.7500%', '3.2500% (325 bps)', '8.0000%'],
  ],
  [600, 1700, 1700, 1500, 2500, 1360]
));
children.push(P(
  'No bisection is run. The engine reads rfr.baseRate (4.7500%) and looks up the active margin for each calendar day from marginSchedule[]. The daily interest accrual is:'
));
children.push(codeP(
  'dailyInterest  =  30,000,000  ×  (SONIA + margin_t)  ×  (1 / 365)\n\n'
  + 'Period 1 (Yrs 1-2):  30M × 7.50% / 365  =  £6,164.38 / day\n'
  + 'Period 2 (Yrs 3-4):  30M × 7.75% / 365  =  £6,369.86 / day\n'
  + 'Period 3 (Yr 5):     30M × 8.00% / 365  =  £6,575.34 / day'
));
children.push(H2('8.3  Time-weighted average EIR'));
children.push(P(
  'For display purposes, the time-weighted average EIR across the 5-year life:'
));
children.push(codeP('Avg EIR  =  (2 × 7.50% + 2 × 7.75% + 1 × 8.00%) / 5  =  7.7000%'));
children.push(callout('Critical distinction', [
  'For an RFR deal, EIR is NOT a single bisection-solved number. The schedule of period EIRs is the locked rate set per IFRS 9. When auditors ask "what is the EIR for this deal," the correct answer is "it varies by period — here is the schedule." The Evidence Pack panel "EIR Calculation Trace" displays the period table; the new Phase 1 panel "Margin Schedule" shows the ratchet contractually.'
]));

// 9. Worked example 3 — Aurora multi-tranche aggregate
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('9.  Worked example 3 — Aurora multi-tranche aggregate'));
children.push(P(
  'Aurora Renewables Phase 1 is a £120m facility with two fixed-rate tranches. Per IFRS 9 §B5.4 EIR is solved at the lowest cashflow-bearing unit (each tranche), and aggregated only for headline display. Journals post per-tranche.'
));
children.push(buildTable(
  ['Tranche', 'Face', 'Coupon', 'EIR-incl. fee', 'Solved EIR'],
  [
    ['Senior · 5.75% fixed', 'GBP 80,000,000', '5.7500%', 'GBP 400,000', '5.8683%'],
    ['Mezz · 9.25% fixed',   'GBP 40,000,000', '9.2500%', 'GBP 600,000', '9.6421%'],
  ],
  [2400, 1900, 1500, 1900, 1660]
));
children.push(H2('9.1  Face-weighted aggregate'));
children.push(codeP(
  'Deal EIR  =  (80,000,000 × 5.8683%  +  40,000,000 × 9.6421%)  /  120,000,000\n'
  + '          =  (4,694,640  +  3,856,840)  /  120,000,000\n'
  + '          =  7.1262%'
));
children.push(P(
  'Senior carrying value accretes at 5.8683%; Mezz carrying value accretes at 9.6421%. The 7.1262% aggregate appears on the deal summary card for display purposes — it does not drive any accounting movement.'
));

// 10. Modification accounting
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('10.  Modification accounting — when EIR is re-derived'));
children.push(P(
  'Modifications to a financial asset are handled under IFRS 9 §5.4.3. The engine\'s logic:'
));
children.push(buildTable(
  ['Step', 'Action'],
  [
    ['1', 'Detect modification event from instrument.modificationEvents[]'],
    ['2', 'Compute PV of modified cashflows discounted at ORIGINAL EIR — call this PV_new(orig_EIR)'],
    ['3', 'Compute |PV_new(orig_EIR) − Carrying_old| / Carrying_old'],
    ['4', 'If ≥ substantialThreshold (default 10%): SUBSTANTIAL → derecognise + recognise + re-solve EIR'],
    ['5', 'If < threshold: NON-SUBSTANTIAL → adjust carrying value to PV_new, post P&L to 442000, retain original EIR'],
  ],
  [800, 8560]
));
children.push(H2('10.1  Substantial-modification journal pattern'));
children.push(jeTable([
  ['141000', 'Derecognise old loan asset at carrying value', '', '80,400,000'],
  ['141000', 'Recognise new loan asset at fair value',          '79,500,000', ''],
  ['442000', 'Modification loss (recognition - derecognition)', '900,000', ''],
], 'GBP'));
children.push(P(
  'Post derecognition, the engine solves a new EIR over the modified cashflow set from the modification date forward. That new EIR is locked from that date and used for the remainder of the asset\'s life (or until the next substantial modification).'
));
children.push(H2('10.2  Non-substantial-modification journal pattern'));
children.push(jeTable([
  ['141000', 'Adjust carrying value to PV_new at original EIR', '', '125,000'],
  ['442000', 'Non-substantial modification loss', '125,000', ''],
], 'GBP'));
children.push(P('Original EIR is retained; the engine recomputes the daily accretion schedule from the modification date forward using the adjusted carrying value and original EIR.'));

// 11. Audit trail
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('11.  Audit trail — where to find evidence'));
children.push(buildTable(
  ['Evidence', 'Where it lives', 'What it shows'],
  [
    ['Deal record',
     'PortF (System of Record)',
     'Face value, coupon, fees, marginSchedule, day-count basis, IFRS classification.'],
    ['Engine computation source',
     'loan-module-engine.js, computeEIR(instr) function (line ~143)',
     'The actual JavaScript that runs every computation. Open-source readable. Versioned.'],
    ['Cashflow stack used in the solve',
     'Daily Schedule CSV (export from Stage 2)',
     '47-column per-day output showing every cashflow component fed to the engine.'],
    ['NPV equation + bisection iterations',
     'Stage 2 Evidence Pack → EIR Calculation Trace button (modal popup)',
     'For the loaded deal: cashflow table, NPV equation, every bisection iteration with NPV at each midpoint, final EIR.'],
    ['Margin schedule (RFR deals only)',
     'Stage 1 Phase 1 → Margin Schedule panel (auto-shown when present)',
     'Contractual ratchet schedule with from/to dates, margin bps, all-in rate per period.'],
    ['Carrying value reconciliation',
     'Stage 2 Evidence Pack → Carrying Value Waterfall',
     'IAS 1 §54 movement reconciliation from opening to closing carrying, itemised by driver.'],
    ['Run history',
     'Stage 2 Evidence Pack → Modification History + Audit Run History',
     'Last 10 runs across all deals with run ID, version, user, timestamp, default vs override flag.'],
    ['Treatment overrides',
     'Stage 2 → Treatment panel',
     'Every IFRS treatment field exposed for override. Override flag bubbles into the run-history audit log.'],
  ],
  [2200, 3000, 4160]
));

// 12. Common audit questions
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('12.  Common audit questions — and where to find the answers'));

const faqs = [
  ['Q1. Why does this loan\'s EIR differ from its coupon?',
   'Because an EIR-included fee (typically arrangement / origination) is being spread over the life via EIR per IFRS 9 §B5.4. The "spread" line in the Evidence Pack quantifies it. For a deal drawn at par with no upfront EIR-included fees, EIR equals the coupon.'],
  ['Q2. Why is there no single EIR for this floating-rate deal?',
   'Because the contractual coupon resets every period (e.g. quarterly compounded SONIA), so a single fixed EIR would be meaningless. Per IFRS 9 §B5.4, the engine constructs EIR_t = rfr.baseRate + margin_t for each period and uses the period-specific EIR for daily accrual. See §5.2 above for the construction logic and §8 for the worked example.'],
  ['Q3. The deal-level EIR doesn\'t match the per-tranche EIRs — is this correct?',
   'Yes. For multi-tranche deals, each tranche has its own EIR (per §B5.4 "lowest cashflow-bearing unit"). The deal-level number is a face-weighted aggregate for display only. Journals post per-tranche using the per-tranche EIRs. See §9 for the Aurora worked example.'],
  ['Q4. Was the EIR re-derived after this modification?',
   'Check the Modification History panel in Stage 2 Evidence Pack. Substantial modifications (PV change ≥ 10% threshold) are flagged with "EIR re-derived" and show before/after EIR. Non-substantial modifications retain the original EIR and adjust carrying value to PV at original EIR.'],
  ['Q5. How do you handle the £20k arrangement fee in the EIR calculation?',
   'If the fee is recognised under IFRS 9-EIR treatment (the seed instrument tags it ifrs: "IFRS9-EIR"), the engine reduces the day-1 net outflow by the fee amount and solves bisection over that set. The fee is then accreted into interest income daily over the deal\'s life via the EIR accretion mechanism. If the fee is tagged IFRS15-pointInTime or IFRS15-overTime, it is NOT in the EIR solve — it goes through P&L separately.'],
  ['Q6. The engine\'s EIR result differs from my manual Excel IRR — by how much?',
   'Bisection tolerance is 1e-6, which translates to roughly £0.01 of NPV error on a £10m deal. Excel\'s IRR uses Newton-Raphson with default tolerance 1e-5. For typical deals the answers agree to 4 decimal places. The Evidence Pack Variance row shows the difference between the engine\'s posted ECL and a discounted PV cross-check.'],
  ['Q7. Where does the SONIA rate come from for an RFR deal?',
   'In the seed dataset it\'s an illustrative single reset (e.g. 4.7500% as the "current" SONIA). In production it would come from a market data feed (e.g. Bloomberg / Refinitiv) plugged into rfr.rateSchedule[]. The engine reads whichever is configured and applies the active reset for each day.'],
  ['Q8. How is segregation of duties enforced on the EIR posting workflow?',
   'The Month-End Close workflow in Stage 2 has four gates: Draft → Reviewed → Approved → Posted. In production each gate would require a different user role. Stage 3 push to Workday is gated on Approved. Override flags in the run-history audit log surface any deviation from default treatment.'],
];

for (const [q, a] of faqs) {
  children.push(H3(q));
  children.push(P(a));
}

// 13. Glossary
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('13.  Glossary'));
children.push(buildTable(
  ['Term', 'Definition'],
  [
    ['EIR',           'Effective Interest Rate. The rate that NPVs all contractual cashflows to the gross carrying amount at recognition. IFRS 9 §B5.4.'],
    ['Coupon rate',   'The contractual rate printed on the loan agreement. Differs from EIR when EIR-included fees or OID exist.'],
    ['Cash yield',    'Annual coupon ÷ price paid at recognition. Different from EIR.'],
    ['Implied YTM',   'Yield-to-maturity solved from purchase price and projected coupon cashflows.'],
    ['Effective yield','Synonym for EIR when used in the engine\'s output object.'],
    ['Carrying value','The amortised-cost balance: face value, adjusted for EIR accretion, fees, modifications, FX, hedge P&L. Per IAS 1 §54.'],
    ['EIR-included fee','A fee that is part of the EIR per IFRS 9 §B5.4 — typically arrangement / origination / upfront fees. Recognised over life via EIR accretion.'],
    ['Substantial modification','§5.4.3 — when PV change ≥ 10% threshold. Triggers derecognition + recognition with new EIR.'],
    ['SPPI',          'Solely Payments of Principal and Interest. The IFRS 9 §4.1.2 cashflow test. If SPPI fails, the asset goes FVTPL.'],
    ['RFR',           'Risk-Free Rate (SONIA, SOFR, ESTR, EURIBOR, TONA, FED). Daily-reset reference rate.'],
    ['marginSchedule','Array of {from, to, marginBps} entries. Defines the contractual margin ratchet for an RFR deal.'],
    ['Tranche',       'One of multiple cashflow-bearing units within a single deal record. Each tranche has its own coupon, fees, principal schedule, and EIR.'],
    ['Day-count basis','ACT/360, ACT/365, ACT/ACT, 30/360. Determines the fraction of a year for each calendar day in the accrual schedule.'],
    ['Bisection',     'Numerical root-finding algorithm. Repeatedly halves an interval to converge on the rate where NPV = 0.'],
    ['Tolerance',     'The threshold below which |NPV(mid)| is treated as zero. Engine uses 1e-6.'],
    ['Treatment panel','Stage 2 UI section exposing every IFRS treatment for override (classification, ECL stage, modification policy, PIK, fee IFRS routing, etc.).'],
    ['Evidence Pack', 'The 7-panel audit trail beneath the Stage 2 journal table (Month-End Close, Carrying Value Waterfall, PoP Variance, FV Sensitivities, ECL Templates, Modification History, ECL Trace).'],
  ],
  [2200, 7160]
));

// References
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1('14.  References'));
children.push(H2('14.1  IFRS standards'));
children.push(bullet('IFRS 9 §B5.4 — Effective interest method'));
children.push(bullet('IFRS 9 §5.4.3 — Modifications of contractual cash flows'));
children.push(bullet('IFRS 9 §4.1.2 — SPPI cash-flow characteristics test'));
children.push(bullet('IFRS 9 §5.5 — Expected credit loss model'));
children.push(bullet('IFRS 15 §B40 — Fees in the form of incremental costs'));
children.push(bullet('IAS 1 §54 — Information to be presented on the face of the statement of financial position'));

children.push(H2('14.2  Engine source files'));
children.push(bullet('loan-module-engine.js · computeEIR(instr) — line ~143 — the EIR solver and dispatcher'));
children.push(bullet('loan-module-engine.js · solveYield(targetNPV, cashflows) — line ~82 — the bisection solver'));
children.push(bullet('loan-module-engine.js · aggregateChildEIRs() — face-weighted aggregation for tranches and underlyings'));
children.push(bullet('loan-module-engine.js · buildSchedule(instr) — line ~282 — daily accrual schedule generator'));
children.push(bullet('loan-module-integration-layer.html · renderEIRBilateralTrace() / renderEIRTrancheTrace() / renderEIRRFRTrace() — the Evidence Pack popup renderers'));

children.push(H2('14.3  Related documents'));
children.push(bullet('Loan Module Integration Layer User Guide (PDF)'));
children.push(bullet('PortF Excel Template Guide'));
children.push(bullet('GL gap inventory (investran-gl-chart-NewReport4.md)'));
children.push(bullet('Stage 2 Demo Guide (covered features)'));

children.push(spacer(240));
children.push(P('— end of document —', { italics: true, color: SLATE, align: AlignmentType.CENTER }));

// ─── BUILD ──────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'NWF / FIS Capital Partners',
  title: 'EIR Calculation Methodology',
  description: 'Accountant-facing methodology document for the Loan Module Integration Layer',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: NAVY },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: NAVY },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial', color: TEAL },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 240 } } } }]
    }]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },     // US Letter
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: 'EIR Calculation Methodology', color: SLATE, size: 18, font: 'Arial' }),
            new TextRun({ text: '\tv2026-05-11', color: SLATE, size: 18, font: 'Arial' })
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: 'NWF / FIS Capital Partners · Internal use', color: SLATE, size: 18, font: 'Arial' }),
            new TextRun({ text: '\tPage ', color: SLATE, size: 18, font: 'Arial' }),
            new TextRun({ children: [PageNumber.CURRENT], color: SLATE, size: 18, font: 'Arial' })
          ]
        })]
      })
    },
    children
  }]
});

const outFile = process.env.EIR_DOC_OUT
  || '/Users/ferhatansari/Claude Cowork folder/Claude Income Calculator/EIR-Calculation-Methodology.docx';

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outFile, buf);
  console.log('  ✓ Wrote', outFile);
}).catch(e => { console.error(e); process.exit(1); });

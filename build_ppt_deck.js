/**
 * Build the Loan Module Integration Layer overview deck.
 * 5 slides — Architecture, Pipeline, Stage 2 deep-dive, Outputs, Coverage.
 *
 * Palette: Ocean Gradient — 21295C navy · 065A82 deep blue · 1C7293 teal
 * + 4ECDC4 mint (highlight) · F1F5F9 cream (section bg) · FFFFFF white
 */
const pptxgen = require('pptxgenjs');

const C = {
  NAVY:  '21295C',
  BLUE:  '065A82',
  TEAL:  '1C7293',
  MINT:  '4ECDC4',
  AMBER: 'F4A261',
  CREAM: 'F1F5F9',
  WHITE: 'FFFFFF',
  TXT:   '1F2937',
  MUTED: '64748B',
  GRID:  'CBD5E1'
};

const HEADER_FONT = 'Calibri';
const BODY_FONT   = 'Calibri';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';     // 13.33" × 7.5"
pres.author = 'NWF / FIS Capital Partners';
pres.title  = 'Loan Module Integration Layer — Overview';

const W = 13.33, H = 7.5;

// ============================================================
//   SLIDE 1 — Title + 3-system architecture
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.NAVY };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.MINT }, line: { type: 'none' } });

  s.addText('Loan Module Integration Layer', {
    x: 0.6, y: 0.55, w: 12, h: 0.85,
    fontFace: HEADER_FONT, fontSize: 38, bold: true, color: C.WHITE, margin: 0
  });
  s.addText('PortF (System of Record) → PCS / Investran (IFRS Accounting) → Workday (General Ledger)', {
    x: 0.6, y: 1.4, w: 12, h: 0.4,
    fontFace: BODY_FONT, fontSize: 16, color: 'B8C7E8', margin: 0
  });
  s.addText('with full reconciliation and feedback to PortF', {
    x: 0.6, y: 1.78, w: 12, h: 0.35,
    fontFace: BODY_FONT, fontSize: 13, italic: true, color: '8DA0CC', margin: 0
  });

  const cardY = 2.6, cardH = 3.1, cardW = 3.95, gap = 0.25;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;

  const cards = [
    { title: 'PortF', sub: 'System of Record', role: 'Owns the commercial reality',
      bullets: ['Deal capture · ratchets · drawdowns', 'Cashflow generation', 'Workflow + approvals', 'Covenant tracking', 'Borrower monitoring'],
      bg: C.BLUE, accent: C.MINT },
    { title: 'PCS / Investran', sub: 'IFRS Accounting Sub-ledger', role: 'Owns the financial-statement representation',
      bullets: ['EIR + amortised cost', 'Fee amortisation (IFRS 9 / 15)', 'IFRS 9 ECL Stage 1/2/3', 'Modification + Hedge accounting', 'Journal generation + disclosures'],
      bg: C.TEAL, accent: C.MINT },
    { title: 'Workday', sub: 'General Ledger', role: 'Posts batches · returns actuals',
      bullets: ['Receives DIU batches via externalKey', 'Idempotent retries', 'Posts to GL accounts', 'Returns actual cash settlements', 'Closes period'],
      bg: '0F4F73', accent: C.AMBER }
  ];

  cards.forEach((c, i) => {
    const x = startX + i * (cardW + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: c.bg }, line: { color: 'FFFFFF', width: 0.5 },
      shadow: { type: 'outer', color: '000000', blur: 12, offset: 4, angle: 90, opacity: 0.25 }
    });
    s.addShape(pres.shapes.RECTANGLE, { x, y: cardY, w: cardW, h: 0.08, fill: { color: c.accent }, line: { type: 'none' } });
    s.addText(c.title,  { x: x + 0.3, y: cardY + 0.2, w: cardW - 0.6, h: 0.55, fontFace: HEADER_FONT, fontSize: 24, bold: true, color: C.WHITE, margin: 0 });
    s.addText(c.sub,    { x: x + 0.3, y: cardY + 0.78, w: cardW - 0.6, h: 0.32, fontFace: BODY_FONT, fontSize: 13, color: 'CDE4F0', margin: 0 });
    s.addText(c.role,   { x: x + 0.3, y: cardY + 1.12, w: cardW - 0.6, h: 0.32, fontFace: BODY_FONT, fontSize: 11, italic: true, color: c.accent, margin: 0 });
    s.addText(c.bullets.map((t, idx) => ({ text: t, options: { bullet: true, breakLine: idx < c.bullets.length - 1 } })), {
      x: x + 0.3, y: cardY + 1.55, w: cardW - 0.6, h: cardH - 1.7,
      fontFace: BODY_FONT, fontSize: 12, color: C.WHITE, paraSpaceAfter: 4, margin: 0
    });
  });

  const oY = 6.1;
  s.addShape(pres.shapes.RECTANGLE, {
    x: 1.5, y: oY, w: W - 3.0, h: 0.7,
    fill: { color: C.MINT }, line: { type: 'none' },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 3, angle: 90, opacity: 0.3 }
  });
  s.addText('Integration Layer · 5-stage pipeline orchestrating data + reconciliation between all three systems', {
    x: 1.5, y: oY, w: W - 3.0, h: 0.7,
    fontFace: HEADER_FONT, fontSize: 14, bold: true, color: C.NAVY, align: 'center', valign: 'middle', margin: 0
  });

  s.addText('Loan Module Integration Layer · NWF / FIS Capital Partners · 2026', {
    x: 0.6, y: H - 0.4, w: 12, h: 0.3,
    fontFace: BODY_FONT, fontSize: 9, color: '8DA0CC', margin: 0
  });
}

// ============================================================
//   SLIDE 2 — 5-stage pipeline
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.CREAM };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.MINT }, line: { type: 'none' } });

  s.addText('End-to-End Pipeline · 5 Stages', {
    x: 0.6, y: 0.3, w: 12, h: 0.6,
    fontFace: HEADER_FONT, fontSize: 28, bold: true, color: C.NAVY, margin: 0
  });
  s.addText('Each stage has a clear owner. Data flows left-to-right; reconciliation flows back to PortF.', {
    x: 0.6, y: 0.95, w: 12, h: 0.3,
    fontFace: BODY_FONT, fontSize: 13, color: C.MUTED, margin: 0
  });

  const stages = [
    { num: '1', title: 'PortF Inbound', owner: 'PortF', color: C.BLUE,
      what: 'Load contractual cashflows', io: 'JSON · Excel · Sample',
      out: 'Setup metadata · Fees · Daily schedule · Source badges' },
    { num: '2', title: 'PCS Accounting', owner: 'PCS · IFRS engine', color: C.TEAL,
      what: 'Generate IFRS journals', io: 'Treatment overrides',
      out: 'EIR · ECL · Carrying value · DIU batch · 10 capability cards · 7 Evidence panels' },
    { num: '3', title: 'Workday GL Push', owner: 'Workday GL', color: '0F4F73',
      what: 'Post DIU batch', io: 'externalKey idempotent',
      out: 'GL + PortfolioPosition tabs · Sequential batchIDs per glDate · CSV downloads' },
    { num: '4', title: 'Workday Actuals', owner: 'Workday GL', color: C.NAVY,
      what: 'Receive actual cash', io: 'Multi-period batches',
      out: 'Per-period actuals · Status flags · Batch list' },
    { num: '5', title: 'Reconciliation', owner: 'PCS + PortF', color: C.BLUE,
      what: 'Reconcile + feedback', io: 'Per-batch · per-period',
      out: 'Tied / Within / Break · Feedback JSON to PortF' }
  ];

  const cardY = 1.5, cardH = 5.2, gap = 0.18;
  const totalW = W - 1.0, cardW = (totalW - gap * 4) / 5;
  let curX = 0.5;

  stages.forEach((st, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: curX, y: cardY, w: cardW, h: cardH,
      fill: { color: C.WHITE }, line: { color: C.GRID, width: 0.5 },
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.1 }
    });
    s.addShape(pres.shapes.RECTANGLE, { x: curX, y: cardY, w: cardW, h: 0.65, fill: { color: st.color }, line: { type: 'none' } });
    s.addText(st.num, { x: curX, y: cardY, w: cardW, h: 0.65, fontFace: HEADER_FONT, fontSize: 30, bold: true, color: C.WHITE, align: 'center', valign: 'middle', margin: 0 });

    s.addText(st.title, { x: curX + 0.2, y: cardY + 0.78, w: cardW - 0.4, h: 0.4, fontFace: HEADER_FONT, fontSize: 14, bold: true, color: C.NAVY, margin: 0 });
    s.addText(st.owner, { x: curX + 0.2, y: cardY + 1.18, w: cardW - 0.4, h: 0.3, fontFace: BODY_FONT, fontSize: 10, italic: true, color: st.color, margin: 0 });
    s.addText(st.what, { x: curX + 0.2, y: cardY + 1.55, w: cardW - 0.4, h: 0.4, fontFace: BODY_FONT, fontSize: 12, bold: true, color: C.TXT, margin: 0 });

    s.addShape(pres.shapes.RECTANGLE, { x: curX + 0.2, y: cardY + 2.05, w: cardW - 0.4, h: 0.04, fill: { color: C.GRID }, line: { type: 'none' } });
    s.addText('INPUTS', { x: curX + 0.2, y: cardY + 2.15, w: cardW - 0.4, h: 0.25, fontFace: BODY_FONT, fontSize: 8, bold: true, color: C.MUTED, charSpacing: 1, margin: 0 });
    s.addText(st.io, { x: curX + 0.2, y: cardY + 2.4, w: cardW - 0.4, h: 0.4, fontFace: BODY_FONT, fontSize: 10, color: C.TXT, margin: 0 });

    s.addShape(pres.shapes.RECTANGLE, { x: curX + 0.2, y: cardY + 2.95, w: cardW - 0.4, h: 0.04, fill: { color: C.GRID }, line: { type: 'none' } });
    s.addText('OUTPUTS', { x: curX + 0.2, y: cardY + 3.05, w: cardW - 0.4, h: 0.25, fontFace: BODY_FONT, fontSize: 8, bold: true, color: C.MUTED, charSpacing: 1, margin: 0 });
    s.addText(st.out, { x: curX + 0.2, y: cardY + 3.3, w: cardW - 0.4, h: 1.85, fontFace: BODY_FONT, fontSize: 10, color: C.TXT, margin: 0 });

    if(i < stages.length - 1){
      s.addText('▶', { x: curX + cardW - 0.05, y: cardY + cardH/2 - 0.3, w: 0.3, h: 0.4, fontFace: BODY_FONT, fontSize: 16, bold: true, color: st.color, align: 'center', margin: 0 });
    }

    curX += cardW + gap;
  });

  s.addText('Stages 4 & 5 repeat each accounting period. Save / Load preserves all batches and reconciliations across sessions.', {
    x: 0.6, y: H - 0.5, w: 12, h: 0.3,
    fontFace: BODY_FONT, fontSize: 11, italic: true, color: C.MUTED, margin: 0
  });
}

// ============================================================
//   SLIDE 3 — Stage 2 deep dive
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.CREAM };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.MINT }, line: { type: 'none' } });

  s.addText('Stage 2 — IFRS Accounting Engine', {
    x: 0.6, y: 0.3, w: 9, h: 0.55,
    fontFace: HEADER_FONT, fontSize: 28, bold: true, color: C.NAVY, margin: 0
  });
  s.addText('Owns EIR · amortised cost · fee amortisation · accruals · journals · ECL reserve · disclosures', {
    x: 0.6, y: 0.92, w: 9, h: 0.3,
    fontFace: BODY_FONT, fontSize: 13, color: C.MUTED, margin: 0
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 9.7, y: 0.35, w: 3.1, h: 1.0,
    fill: { color: C.NAVY }, line: { type: 'none' }
  });
  s.addText('26/26', { x: 9.7, y: 0.4, w: 3.1, h: 0.55, fontFace: HEADER_FONT, fontSize: 36, bold: true, color: C.MINT, align: 'center', margin: 0 });
  s.addText('accounting capabilities · 0 gaps', { x: 9.7, y: 0.95, w: 3.1, h: 0.35, fontFace: BODY_FONT, fontSize: 10, color: C.WHITE, align: 'center', margin: 0 });

  const qY = 1.55, qH = 2.7, qW = 6.15, qX1 = 0.5, qX2 = 6.85;
  const quads = [
    { x: qX1, y: qY, title: '10 Capability Cards', sub: 'IFRS-aligned accounting matrix',
      bullets: ['IFRS 9 §5.1 — initial recognition (AC / FVOCI / FVTPL)',
                'IFRS 9 §B5.4 — EIR (5 coupon families + multi-tranche)',
                'IFRS 9 §5.5 — ECL Stage 1 / 2 / 3 / POCI',
                'IFRS 9 §5.4.3 — modification accounting',
                'IFRS 9 §6 — hedge accounting (CFH / FVH)',
                'IFRS 13 §72 — fair value hierarchy + sensitivities',
                'IFRS 15 — fee revenue (over-time / point-in-time)'],
      color: C.BLUE },
    { x: qX2, y: qY, title: 'Editable Treatment Panel', sub: '24+ live controls · auto re-run on change',
      bullets: ['Classification · SPPI · business model · FV Level',
                'ECL Stage · PD · LGD · CCF · macro overlay',
                'DPD current — auto-migrates Stage on threshold',
                'Covenant breach — qualitative SICR trigger',
                'Modification events (inline editor)',
                'PIK contractual override',
                'Per-fee IFRS 9 EIR vs IFRS 15 toggle'],
      color: C.TEAL },
    { x: qX1, y: qY + qH + 0.3, title: '7-Panel Evidence Pack', sub: 'Disclosure-grade on every Run Accounting',
      bullets: ['Month-End Close + Run Metadata (4-state workflow)',
                'Carrying Value Waterfall (IAS 1 §54) + Memos',
                'Period-on-Period Variance Walk',
                'FV Sensitivities (IFRS 13 §93) by Level',
                'ECL Journal Templates (6 stage transitions)',
                'ECL Calculation Trace (PD × LGD × EAD × discount)',
                'Modification History + Audit Run History'],
      color: '0F4F73' },
    { x: qX2, y: qY + qH + 0.3, title: 'KPI Strip + Daily Schedule', sub: 'Every figure live · 47-column CSV export',
      bullets: ['Interest (life) · Fees (life) · PIK (life) · EIR Accretion',
                'Receivables (113000) — DR/CR balance',
                'ECL Allowance (145000) — with stage label',
                'JE Rows Generated count',
                'Daily Schedule with 17 columns preview',
                'Material events / All days / Month-end filters',
                'Full CSV (47 fields) + JSON envelope export'],
      color: C.NAVY }
  ];

  quads.forEach(q => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: q.x, y: q.y, w: qW, h: qH,
      fill: { color: C.WHITE }, line: { color: C.GRID, width: 0.5 },
      shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 90, opacity: 0.1 }
    });
    s.addShape(pres.shapes.RECTANGLE, { x: q.x, y: q.y, w: 0.12, h: qH, fill: { color: q.color }, line: { type: 'none' } });
    s.addText(q.title, { x: q.x + 0.32, y: q.y + 0.18, w: qW - 0.5, h: 0.4, fontFace: HEADER_FONT, fontSize: 16, bold: true, color: C.NAVY, margin: 0 });
    s.addText(q.sub,   { x: q.x + 0.32, y: q.y + 0.55, w: qW - 0.5, h: 0.3, fontFace: BODY_FONT, fontSize: 11, italic: true, color: q.color, margin: 0 });
    s.addText(q.bullets.map((t, idx) => ({ text: t, options: { bullet: true, breakLine: idx < q.bullets.length - 1 } })), {
      x: q.x + 0.32, y: q.y + 0.92, w: qW - 0.5, h: qH - 1.0,
      fontFace: BODY_FONT, fontSize: 11, color: C.TXT, paraSpaceAfter: 3, margin: 0
    });
  });

  s.addText('All journals balance · every change cascades · sequential month-end gates Draft → Reviewed → Approved → Posted', {
    x: 0.6, y: H - 0.4, w: 12, h: 0.3,
    fontFace: BODY_FONT, fontSize: 11, italic: true, color: C.MUTED, margin: 0
  });
}

// ============================================================
//   SLIDE 4 — Outputs / Deliverables
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.CREAM };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.MINT }, line: { type: 'none' } });

  s.addText('Outputs · What Gets Produced', {
    x: 0.6, y: 0.3, w: 12, h: 0.55,
    fontFace: HEADER_FONT, fontSize: 28, bold: true, color: C.NAVY, margin: 0
  });
  s.addText('Every run produces auditable, downloadable deliverables for downstream systems and stakeholders.', {
    x: 0.6, y: 0.92, w: 12, h: 0.3,
    fontFace: BODY_FONT, fontSize: 13, color: C.MUTED, margin: 0
  });

  const outputs = [
    { stage: '2', title: 'Filled DIU Workbook', file: 'investran-diu-{deal}-{date}.xlsx',
      desc: 'GL tab (25 cols, sequential batchID per glDate) + PortfolioPosition tab (15 cols matching DIU Sec master).',
      footer: 'Investran-ready · sanitised · 2dp rounded', color: C.TEAL },
    { stage: '2', title: 'Daily Schedule CSV', file: 'schedule-{deal}-{date}.csv',
      desc: '47 columns — every engine field (rate, balance, draws, fees, EIR, ECL, mod, FX, hedge MTM).',
      footer: 'UTF-8 BOM · filterable in-app', color: C.BLUE },
    { stage: '2', title: 'DIU Template (blank)', file: 'investran-diu-template-blank.csv',
      desc: 'Empty 24-column DIU template for hand-off to operators or alternate ingestion paths.',
      footer: 'Same headers as Filled DIU', color: '0F4F73' },
    { stage: '3', title: 'Workday CSV (slim)', file: 'workday-diu-{deal}-{date}.csv',
      desc: '12-column subset for Workday GL ingestion. Same sanitisation + balance check as the XLSX.',
      footer: 'Stage 3 batch envelope', color: C.NAVY },
    { stage: '5', title: 'PortF Feedback JSON', file: 'portf-feedback-{deal}-{date}.json',
      desc: 'Per-batch reconciliation outcome — RECONCILED / RECONCILIATION_BREAKS — with line detail + actions.',
      footer: 'PortF /api/integration/feedback', color: C.TEAL },
    { stage: 'ANY', title: 'Session Save / Load', file: 'lmil-session-{deal}-{date}.json',
      desc: 'Full pipeline state snapshot — restore the deal at any stage with all batches + reconciliations.',
      footer: 'localStorage · also exportable', color: C.AMBER }
  ];

  const cardY = 1.45, gap = 0.25, cardH = 2.55;
  const totalW = W - 1.0, cardW = (totalW - gap * 2) / 3;

  outputs.forEach((o, idx) => {
    const col = idx % 3, row = Math.floor(idx / 3);
    const x = 0.5 + col * (cardW + gap);
    const y = cardY + row * (cardH + 0.25);

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.WHITE }, line: { color: C.GRID, width: 0.5 },
      shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 90, opacity: 0.1 }
    });
    s.addShape(pres.shapes.RECTANGLE, { x: x + cardW - 0.95, y: y + 0.15, w: 0.8, h: 0.32, fill: { color: o.color }, line: { type: 'none' } });
    s.addText('Stage ' + o.stage, { x: x + cardW - 0.95, y: y + 0.15, w: 0.8, h: 0.32, fontFace: BODY_FONT, fontSize: 9, bold: true, color: C.WHITE, align: 'center', valign: 'middle', margin: 0 });
    s.addText(o.title, { x: x + 0.25, y: y + 0.18, w: cardW - 1.3, h: 0.4, fontFace: HEADER_FONT, fontSize: 15, bold: true, color: C.NAVY, margin: 0 });
    s.addText(o.file, { x: x + 0.25, y: y + 0.6, w: cardW - 0.5, h: 0.3, fontFace: 'Consolas', fontSize: 10, color: o.color, margin: 0 });
    s.addText(o.desc, { x: x + 0.25, y: y + 1.0, w: cardW - 0.5, h: 1.1, fontFace: BODY_FONT, fontSize: 11, color: C.TXT, margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: x + 0.25, y: y + cardH - 0.45, w: cardW - 0.5, h: 0.02, fill: { color: C.GRID }, line: { type: 'none' } });
    s.addText(o.footer, { x: x + 0.25, y: y + cardH - 0.42, w: cardW - 0.5, h: 0.32, fontFace: BODY_FONT, fontSize: 10, italic: true, color: C.MUTED, margin: 0 });
  });

  s.addText('All CSV outputs use UTF-8 BOM + ASCII sanitisation · money fields rounded to 2 decimal places.', {
    x: 0.6, y: H - 0.4, w: 12, h: 0.3,
    fontFace: BODY_FONT, fontSize: 11, italic: true, color: C.MUTED, margin: 0
  });
}

// ============================================================
//   SLIDE 5 — Coverage / closing
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.NAVY };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.MINT }, line: { type: 'none' } });

  s.addText('What This Application Replaces', {
    x: 0.6, y: 0.3, w: 12, h: 0.55,
    fontFace: HEADER_FONT, fontSize: 28, bold: true, color: C.WHITE, margin: 0
  });
  s.addText('From data hand-off to balanced JEs in Workday — fully auditable, fully reconciled.', {
    x: 0.6, y: 0.92, w: 12, h: 0.3,
    fontFace: BODY_FONT, fontSize: 13, color: 'B8C7E8', margin: 0
  });

  const statY = 1.7, statH = 2.2, gap = 0.25;
  const totalW = W - 1.0, statW = (totalW - gap * 3) / 4;
  const stats = [
    { big: '13', small: 'features', sub: 'of the accounting-system requirement\nare fully covered in Stage 2', color: C.MINT },
    { big: '7', small: 'IFRS frameworks', sub: 'IFRS 9 / 13 / 15 + IAS 1 / IFRS 7\n+ §5.4.3 modification + §6 hedge', color: C.AMBER },
    { big: '0', small: 'gaps remaining', sub: 'after the May 2026 5-gap closure\nagainst Accounting requirements doc', color: C.MINT },
    { big: 'AI', small: 'Loan Assistant chat', sub: 'Offline FAQ (53 entries) +\nClaude API for any other question', color: '60A5FA' }
  ];

  let curX = 0.5;
  stats.forEach(st => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: curX, y: statY, w: statW, h: statH,
      fill: { color: '12193E' }, line: { color: '2E3A6E', width: 1 }
    });
    s.addShape(pres.shapes.RECTANGLE, { x: curX, y: statY, w: statW, h: 0.06, fill: { color: st.color }, line: { type: 'none' } });
    s.addText(st.big, { x: curX, y: statY + 0.3, w: statW, h: 0.95, fontFace: HEADER_FONT, fontSize: 56, bold: true, color: st.color, align: 'center', valign: 'middle', margin: 0 });
    s.addText(st.small, { x: curX, y: statY + 1.25, w: statW, h: 0.35, fontFace: HEADER_FONT, fontSize: 14, bold: true, color: C.WHITE, align: 'center', margin: 0 });
    s.addText(st.sub, { x: curX, y: statY + 1.55, w: statW, h: 0.6, fontFace: BODY_FONT, fontSize: 10, color: 'B8C7E8', align: 'center', margin: 0 });
    curX += statW + gap;
  });

  const barY = 4.4;
  s.addText('Each stage has live deliverables · every JE balances · every figure traceable to a source field · session state is persistable.', {
    x: 0.6, y: barY, w: 12, h: 0.4,
    fontFace: BODY_FONT, fontSize: 14, italic: true, color: 'CDE4F0', align: 'center', margin: 0
  });

  const blkY = 5.05, blkH = 1.85, blkGap = 0.4;
  const blkW = (W - 1.0 - blkGap) / 2;
  const blocks = [
    { title: 'For accountants + auditors',
      bullets: ['Carrying Value Waterfall (IAS 1 §54) ties cleanly',
                'ECL Calculation Trace (IFRS 9 §5.5.17) — every multiplicand visible',
                'Per-fee IFRS treatment (IFRS 9 EIR vs IFRS 15) editable',
                'Audit Run History — last 10 runs, version + user + timestamp'] },
    { title: 'For operations',
      bullets: ['Save / Load any stage · multi-period batch reconciliation',
                'Auto-Stage migration on DPD threshold + covenant breach',
                'Idempotent Workday DIU push (deterministic externalKey)',
                'Loan Assistant chat for IFRS / ECL / how-to questions'] }
  ];

  blocks.forEach((b, i) => {
    const x = 0.5 + i * (blkW + blkGap);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: blkY, w: blkW, h: blkH,
      fill: { color: '12193E' }, line: { color: '2E3A6E', width: 1 }
    });
    s.addText(b.title, { x: x + 0.3, y: blkY + 0.15, w: blkW - 0.6, h: 0.35, fontFace: HEADER_FONT, fontSize: 13, bold: true, color: C.MINT, margin: 0 });
    s.addText(b.bullets.map((t, idx) => ({ text: t, options: { bullet: true, breakLine: idx < b.bullets.length - 1 } })), {
      x: x + 0.3, y: blkY + 0.55, w: blkW - 0.6, h: blkH - 0.7,
      fontFace: BODY_FONT, fontSize: 11, color: C.WHITE, paraSpaceAfter: 3, margin: 0
    });
  });

  s.addText('Loan Module Integration Layer · NWF / FIS Capital Partners · 2026 · loan-module-integration-layer.html', {
    x: 0.6, y: H - 0.35, w: 12, h: 0.25,
    fontFace: BODY_FONT, fontSize: 9, color: '6E7FB3', margin: 0
  });
}

// Use relative path so it works in both sandbox + user shell
const out = 'Loan-Module-Integration-Layer-Overview.pptx';
pres.writeFile({ fileName: out }).then(() => console.log('Wrote', out));

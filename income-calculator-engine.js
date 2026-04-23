/* -------------------------------------------------------------
 * Income Calculator — Pure Engine
 * -------------------------------------------------------------
 * Zero DOM dependencies. Runs in Node and in the browser.
 *
 * Public entrypoint:
 *     calculate(payload) -> output
 *
 * Input:  see income-calculator-input.schema.md and
 *         income-calculator-input.sample.json.
 *
 * Output: { meta, summary, schedule, periodRows, journalEntries }
 *         see income-calculator-sample-output.json.
 * -------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IncomeCalc = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ONE_DAY = 86400000;

  /* ---------- Date helpers ---------- */
  function toISO(d) {
    const z = new Date(d);
    z.setHours(12, 0, 0, 0);
    return z.toISOString().slice(0, 10);
  }
  function parseISO(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }
  function addDays(d, n) { return new Date(d.getTime() + n * ONE_DAY); }
  function eachDay(from, to) {
    const out = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) out.push(new Date(d));
    return out;
  }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInYear(d) { return isLeap(d.getFullYear()) ? 366 : 365; }

  /* ---------- Day-count ---------- */
  function dayCountFactor(basis, date) {
    switch (basis) {
      case 'ACT/360': return 1 / 360;
      case 'ACT/365': return 1 / 365;
      case 'ACT/ACT': return 1 / daysInYear(date);
      case '30/360':  return 1 / 360;
      default:        return 1 / 360;
    }
  }

  /* ---------- Event lookup ---------- */
  function eventsOn(date, events) {
    const iso = toISO(date);
    return (events || []).filter(e => e.date === iso);
  }

  /* ---------- Holiday calendars ---------- */
  const HOLIDAY_CALENDARS = {
    none: new Set(),
    usFederal: new Set([
      '2019-01-01','2019-01-21','2019-02-18','2019-05-27','2019-07-04','2019-09-02','2019-10-14','2019-11-11','2019-11-28','2019-12-25',
      '2020-01-01','2020-01-20','2020-02-17','2020-05-25','2020-07-03','2020-09-07','2020-10-12','2020-11-11','2020-11-26','2020-12-25',
      '2024-01-01','2024-01-15','2024-02-19','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-10-14','2024-11-11','2024-11-28','2024-12-25',
      '2025-01-01','2025-01-20','2025-02-17','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-10-13','2025-11-11','2025-11-27','2025-12-25',
      '2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25',
      '2027-01-01','2028-01-01','2029-01-01','2030-01-01','2031-01-01'
    ]),
    ukBank: new Set([
      '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
      '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
      '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28'
    ]),
    target: new Set([
      '2024-01-01','2024-03-29','2024-04-01','2024-05-01','2024-12-25','2024-12-26',
      '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-12-25','2025-12-26',
      '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-12-25','2026-12-28'
    ])
  };
  function isHoliday(date, calendarId) {
    const cal = HOLIDAY_CALENDARS[calendarId] || HOLIDAY_CALENDARS.none;
    return cal.has(toISO(date));
  }

  /* ---------- Capitalization gate ---------- */
  function isCapitalizationDay(date, anchor, freq) {
    if (!anchor) return false;
    if (date.getDate() !== anchor.getDate()) return false;
    const months = (date.getFullYear() - anchor.getFullYear()) * 12
                 + (date.getMonth()  - anchor.getMonth());
    if (months <= 0) return false;
    if (freq === 'Monthly')   return months % 1  === 0;
    if (freq === 'Quarterly') return months % 3  === 0;
    if (freq === 'SemiAnnual')return months % 6  === 0;
    if (freq === 'Annual' || freq === 'Yearly') return months % 12 === 0;
    return false;
  }

  /* ---------- IRR / yield solve ---------- */
  function npv(rate, cashflows) {
    let v = 0;
    for (const cf of cashflows) v += cf.amount / Math.pow(1 + rate, cf.t);
    return v;
  }
  function solveYield(targetNPV, cashflows) {
    let lo = -0.99, hi = 5.0;
    const f = r => npv(r, cashflows) - targetNPV;
    let fl = f(lo), fh = f(hi);
    if (fl * fh > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (Math.abs(fm) < 1e-9) return mid;
      if (fl * fm < 0) { hi = mid; fh = fm; } else { lo = mid; fl = fm; }
    }
    return (lo + hi) / 2;
  }

  /* ---------- Effective Interest Rate (EIR) ----------
     Returns an always-computable yield report for the instrument.
     See income-calculator.html::computeEIR for the canonical doc comment. */
  function computeEIR(instr) {
    if (!instr) return null;
    const settle   = parseISO(instr.settlementDate);
    const maturity = parseISO(instr.maturityDate);
    if (!settle || !maturity || maturity <= settle) return null;
    const basis = instr.dayBasis || 'ACT/360';
    const daysPerYear = (basis === 'ACT/365' || basis === 'ACT/ACT') ? 365 : 360;
    const totalDays  = Math.round((maturity - settle) / ONE_DAY);
    const yearsToMat = totalDays / daysPerYear;
    const face  = instr.faceValue || 0;
    const price = instr.purchasePrice || face;
    const amort = instr.amortization || { method: 'none' };
    const c     = instr.coupon || { type: 'Fixed', fixedRate: 0 };
    let couponRate = 0;
    if (c.type === 'Fixed') couponRate = c.fixedRate || 0;
    else {
      let raw = (c.floatingRate || 0) + (c.spread || 0);
      if (c.floor != null) raw = Math.max(raw, c.floor);
      if (c.cap   != null) raw = Math.min(raw, c.cap);
      couponRate = raw;
    }
    const annualCoupon = face * couponRate;

    let impliedYTM = null;
    if (price > 0 && face > 0 && yearsToMat > 0) {
      const cfs = [];
      const fullYears = Math.floor(yearsToMat);
      for (let y = 1; y <= fullYears; y++) cfs.push({ t: y, amount: annualCoupon });
      const stub = yearsToMat - fullYears;
      cfs.push({ t: yearsToMat, amount: face + (stub > 0 ? annualCoupon * stub : 0) });
      impliedYTM = solveYield(price, cfs);
    }

    let effectiveYield = null, source = 'par', note = '';
    if (amort.method === 'effectiveInterestPrice') {
      effectiveYield = impliedYTM;
      source = 'price';
      note = 'Yield solved from purchase price vs. projected coupon cashflows.';
    } else if (amort.method === 'effectiveInterestFormula') {
      effectiveYield = couponRate + (amort.spread != null ? amort.spread : 0);
      source = 'formula';
      note = 'Yield = coupon + user-supplied spread.';
    } else if (amort.method === 'effectiveInterestIRR') {
      effectiveYield = amort.yieldOverride != null ? amort.yieldOverride : couponRate;
      source = 'override';
      note = 'Yield override supplied by user.';
    } else if (amort.method === 'straightLine') {
      source = 'straightLine';
      note = 'Straight-line amortization — no effective yield; implied YTM shown for reference.';
    } else {
      source = price === face ? 'par' : 'implied';
      note = price === face
        ? 'Bond purchased at par — no amortization.'
        : 'No amortization method set — implied YTM shown for reference.';
    }

    const cashYield   = price > 0 ? (annualCoupon / price) : null;
    const totalCoupon = annualCoupon * yearsToMat;
    const totalReturn = (price > 0 && yearsToMat > 0)
      ? ((face + totalCoupon - price) / price) / yearsToMat : null;

    return {
      method: amort.method || 'none',
      couponRate, annualCoupon,
      effectiveYield, impliedYTM, cashYield, totalReturn,
      yearsToMat, dayBasis: basis, source, note
    };
  }

  /* ---------- Core schedule builder ---------- */
  function buildSchedule(instr) {
    if (!instr) return { rows: [], effectiveYield: null };
    const settle   = parseISO(instr.settlementDate);
    const maturity = parseISO(instr.maturityDate);
    if (!settle || !maturity || maturity < settle) return { rows: [], effectiveYield: null };

    const basis  = instr.dayBasis || 'ACT/360';
    const events = (instr.principalSchedule || []).slice().sort((a, b) => a.date.localeCompare(b.date));

    const initialDraw = events.find(e => e.date === toISO(settle) && (e.type === 'draw' || e.type === 'initial'));
    let balance       = initialDraw ? initialDraw.amount : (instr.faceValue || 0);
    let drawnBalance  = balance;
    const commitment  = instr.commitment != null ? instr.commitment : instr.faceValue;

    let carryingValue = (instr.purchasePrice != null ? instr.purchasePrice : instr.faceValue) || 0;

    const totalDays          = Math.round((maturity - settle) / ONE_DAY);
    const couponRateNominal  = instr.coupon && instr.coupon.fixedRate != null ? instr.coupon.fixedRate : 0;

    let effectiveYield = null;
    const amort = instr.amortization || { method: 'none' };
    const daysPerYear = (basis === 'ACT/365' || basis === 'ACT/ACT') ? 365 : 360;

    if (amort.method === 'effectiveInterestPrice' && instr.purchasePrice && instr.faceValue && couponRateNominal) {
      const yearsToMat = totalDays / daysPerYear;
      const cfs = [];
      const coupon = instr.faceValue * couponRateNominal;
      const fullYears = Math.floor(yearsToMat);
      for (let y = 1; y <= fullYears; y++) cfs.push({ t: y, amount: coupon });
      const stub = yearsToMat - fullYears;
      cfs.push({ t: yearsToMat, amount: instr.faceValue + (stub > 0 ? coupon * stub : 0) });
      const seed = solveYield(instr.purchasePrice, cfs);
      const seed2 = (seed == null ? couponRateNominal : seed);

      const runCarrying = (y) => {
        let cv = instr.purchasePrice || 0;
        for (let k = 0; k < totalDays + 1; k++) {
          cv += cv * y * (1 / daysPerYear) - instr.faceValue * couponRateNominal * (1 / daysPerYear);
        }
        return cv;
      };
      let y0 = seed2, y1 = seed2 * 1.001;
      let f0 = runCarrying(y0) - instr.faceValue;
      let f1 = runCarrying(y1) - instr.faceValue;
      for (let i = 0; i < 6 && Math.abs(f1) > 1e-3; i++) {
        const y2 = y1 - f1 * (y1 - y0) / (f1 - f0);
        y0 = y1; f0 = f1; y1 = y2; f1 = runCarrying(y1) - instr.faceValue;
      }
      effectiveYield = y1;
    } else if (amort.method === 'effectiveInterestFormula') {
      effectiveYield = couponRateNominal + (amort.spread != null ? amort.spread : 0);
    } else if (amort.method === 'effectiveInterestIRR') {
      effectiveYield = amort.yieldOverride != null ? amort.yieldOverride : couponRateNominal;
    }

    const straightLineDaily = (amort.method === 'straightLine'
        && instr.purchasePrice != null && instr.faceValue != null && totalDays > 0)
      ? (instr.faceValue - instr.purchasePrice) / totalDays
      : 0;

    const pikEnabled     = !!(instr.pik && instr.pik.enabled);
    const pikRateNominal = pikEnabled ? (instr.pik.rate || 0) : 0;
    const capAnchor      = settle;
    const capFreq        = pikEnabled ? (instr.pik.capitalizationFrequency || 'Monthly') : 'Monthly';

    let cumCashAccrued = 0, cumPikAccrued = 0;
    let cumInterestEarned = 0, cumPikEarned = 0;
    let cumAmort = 0, cumNonUseFee = 0;

    const rows = [];
    const days = eachDay(settle, maturity);

    const amortStart = instr.amortStart ? parseISO(instr.amortStart) : settle;
    const amortEnd   = instr.amortEnd   ? parseISO(instr.amortEnd)   : maturity;

    for (let i = 0; i < days.length; i++) {
      const d = days[i];

      // Events
      const evs = eventsOn(d, events);
      let draw = 0, paydown = 0, initial = 0;
      for (const e of evs) {
        if (e.type === 'initial') { initial += e.amount; }
        else if (e.type === 'draw')    { draw    += e.amount; balance += e.amount; drawnBalance += e.amount; carryingValue += e.amount; }
        else if (e.type === 'paydown') { paydown += e.amount; balance -= e.amount; drawnBalance -= e.amount; carryingValue -= e.amount; }
      }

      // Rate
      let couponRate = instr.coupon && instr.coupon.fixedRate != null ? instr.coupon.fixedRate : 0;
      const floatingRate = instr.coupon && instr.coupon.floatingRate != null ? instr.coupon.floatingRate : 0;
      if (instr.coupon && instr.coupon.type === 'Floating') {
        let r = floatingRate + (instr.coupon.spread != null ? instr.coupon.spread : 0);
        if (instr.coupon.floor != null) r = Math.max(r, instr.coupon.floor);
        if (instr.coupon.cap   != null) r = Math.min(r, instr.coupon.cap);
        couponRate = r;
      }

      // Holiday skip
      const onHoliday = instr.holidayCalendar && instr.holidayCalendar !== 'none'
        ? isHoliday(d, instr.holidayCalendar) : false;
      const skipToday = !!(instr.skipHolidays && onHoliday);
      const inAmortWindow = d >= amortStart && d <= amortEnd;
      const dcf = skipToday ? 0 : dayCountFactor(basis, d);

      // Accruals
      const dailyCash = balance * couponRate * dcf;
      cumCashAccrued    += dailyCash;
      cumInterestEarned += dailyCash;

      let dailyPik = 0;
      if (pikEnabled) {
        dailyPik = balance * pikRateNominal * dcf;
        cumPikAccrued += dailyPik;
        cumPikEarned  += dailyPik;
      }

      let dailyNonUse = 0;
      if (instr.nonUseFee && instr.nonUseFee.enabled && commitment > drawnBalance) {
        dailyNonUse = (commitment - drawnBalance) * (instr.nonUseFee.rate || 0) * dcf;
        cumNonUseFee += dailyNonUse;
      }

      // PIK capitalization
      let capitalized = 0;
      if (pikEnabled && isCapitalizationDay(d, capAnchor, capFreq) && cumPikAccrued > 0) {
        capitalized = cumPikAccrued;
        balance += capitalized;
        carryingValue += capitalized;
        cumPikAccrued = 0;
      }

      // Amortization
      let dailyAmort = 0;
      if (inAmortWindow) {
        if (amort.method === 'straightLine') {
          dailyAmort = straightLineDaily;
          carryingValue += dailyAmort;
          cumAmort += dailyAmort;
        } else if (effectiveYield != null) {
          const dyield = effectiveYield * dcf;
          const effectiveIncome = carryingValue * dyield;
          dailyAmort = effectiveIncome - dailyCash;
          carryingValue += dailyAmort;
          cumAmort += dailyAmort;
        }
      }

      rows.push({
        date: toISO(d),
        dayOfWeek: d.getDay(),
        balance,
        drawnBalance,
        carryingValue,
        initialPurchase: initial || 0,
        draw, paydown,
        couponRate,
        floatingRate,
        dailyCash,
        cumInterestAccrued: cumCashAccrued,
        cumInterestEarned,
        capitalized,
        pikRate: pikEnabled ? pikRateNominal : 0,
        dailyPik,
        cumPikAccrued,
        cumPikEarned,
        amortDaily: dailyAmort,
        cumAmort,
        nonUseFee: dailyNonUse,
        cumNonUseFee,
        onHoliday: !!onHoliday,
        skipped: !!skipToday,
        hasEvent: evs.length > 0 || capitalized > 0
      });
    }

    return { rows, effectiveYield };
  }

  /* ---------- Period summarizer ---------- */
  function summarize(rows, beginISO, endISO) {
    const win = rows.filter(r => r.date >= beginISO && r.date <= endISO);
    const sum = (arr, k) => arr.reduce((a, r) => a + (r[k] || 0), 0);
    return {
      periodStart:      win[0] ? win[0].date : null,
      periodEnd:        win.length ? win[win.length - 1].date : null,
      daysCount:        win.length,
      openingBalance:   win[0] ? win[0].balance : 0,
      closingBalance:   win.length ? win[win.length - 1].balance : 0,
      closingCarrying:  win.length ? win[win.length - 1].carryingValue : 0,
      totalCashAccrual: sum(win, 'dailyCash'),
      totalPikAccrual:  sum(win, 'dailyPik'),
      totalCapitalized: sum(win, 'capitalized'),
      totalAmort:       sum(win, 'amortDaily'),
      totalNonUseFee:   sum(win, 'nonUseFee'),
      windowRows:       win
    };
  }

  /* ---------- DIU journal entries ---------- */
  function generateDIU(instr, summary) {
    if (!summary || !summary.windowRows.length) return [];
    const ctx = { legal: instr.legalEntity, leid: instr.leid, deal: instr.deal, position: instr.position, sec: instr.incomeSecurity };
    const entries = [];
    let jeIndex = 1;
    const add = (transType, amount, isDebit, account, effDate, comments) => {
      entries.push({
        legalEntity: ctx.legal, leid: ctx.leid,
        batchId: 1, jeIndex, txIndex: isDebit ? 2 : 1,
        glDate: summary.periodEnd, effectiveDate: effDate,
        deal: ctx.deal, position: ctx.position, incomeSecurity: ctx.sec,
        transactionType: transType, account, allocationRule: isDebit ? 'Non-Dominant' : 'By Commitment and GL Date',
        batchType: 'Loan Calculator',
        batchComments: `Loan Calculator Entries from ${summary.periodStart} to ${summary.periodEnd}`,
        transactionComments: comments,
        originalAmount: amount,
        amountLE: Math.abs(amount),
        fx: 1, amountLocal: Math.abs(amount),
        isDebit,
        leDomain: 'Investran Global'
      });
    };
    if (summary.totalCashAccrual) {
      add('Interest Receivable', summary.totalCashAccrual, false, '40100', summary.periodEnd, `Interest Adjustment for ${summary.periodEnd}`);
      add('Income - Daily Accrued Interest', summary.totalCashAccrual, true, '23000', summary.periodEnd, `Interest Adjustment for ${summary.periodEnd}`);
      jeIndex++;
    }
    if (summary.totalCapitalized) {
      add('PIK Investment', -summary.totalCapitalized, true, '40100', summary.periodEnd, `PIK Capitalization for ${summary.periodEnd}`);
      add('Interest Receivable', -summary.totalCapitalized, false, '23000', summary.periodEnd, `PIK Capitalization for ${summary.periodEnd}`);
      jeIndex++;
    }
    if (Math.abs(summary.totalAmort) > 0.005) {
      const label = summary.totalAmort > 0 ? 'Discount Accretion' : 'Premium Amortization';
      add(label, summary.totalAmort, false, '40150', summary.periodEnd, `${label} for ${summary.periodEnd}`);
      add(label + ' Offset', summary.totalAmort, true, '23000', summary.periodEnd, `${label} for ${summary.periodEnd}`);
      jeIndex++;
    }
    if (summary.totalNonUseFee > 0.005) {
      add('Non-Use Fee Income', summary.totalNonUseFee, false, '40200', summary.periodEnd, `Non-use fee for ${summary.periodEnd}`);
      add('Non-Use Fee Receivable', summary.totalNonUseFee, true, '23100', summary.periodEnd, `Non-use fee for ${summary.periodEnd}`);
      jeIndex++;
    }
    return entries;
  }

  /* ---------- Payload validator ---------- */
  function validate(payload) {
    const errs = [];
    if (!payload || typeof payload !== 'object') return ['Payload must be an object'];
    if (!payload.period) errs.push('Missing "period"');
    else {
      if (!payload.period.begin) errs.push('Missing period.begin');
      if (!payload.period.end)   errs.push('Missing period.end');
    }
    if (!payload.instrument) errs.push('Missing "instrument"');
    else {
      const i = payload.instrument;
      ['id', 'settlementDate', 'maturityDate', 'dayBasis', 'faceValue', 'purchasePrice'].forEach(k => {
        if (i[k] == null) errs.push(`Missing instrument.${k}`);
      });
      if (!i.coupon) errs.push('Missing instrument.coupon');
      if (!i.amortization) errs.push('Missing instrument.amortization');
      if (!Array.isArray(i.principalSchedule)) errs.push('instrument.principalSchedule must be an array');
    }
    return errs;
  }

  /* ---------- Public entrypoint ---------- */
  function calculate(payload) {
    const errors = validate(payload);
    if (errors.length) {
      return { ok: false, errors };
    }
    const instrument = payload.instrument;
    const period     = payload.period;

    const built   = buildSchedule(instrument);
    const summary = summarize(built.rows, period.begin, period.end);
    const eir     = computeEIR(instrument);
    // Align EIR's "effectiveYield" with the schedule-refined yield actually applied.
    if (eir && built.effectiveYield != null && eir.source === 'price') {
      eir.effectiveYield = built.effectiveYield;
    }
    const je      = generateDIU(instrument, summary);

    const { windowRows, ...summaryOut } = summary;

    return {
      ok: true,
      meta: {
        generatedAt: new Date().toISOString(),
        engineVersion: '1.0.0',
        instrumentId: instrument.id,
        instrumentType: instrument.type || null,
        period: {
          begin: period.begin,
          end:   period.end,
          last:  period.last || null
        },
        effectiveYield: built.effectiveYield,
        amortizationMethod: (instrument.amortization || {}).method || 'none',
        dayBasis: instrument.dayBasis
      },
      effectiveInterestRate: eir,
      summary: summaryOut,
      periodRows: windowRows,
      schedule: built.rows,
      journalEntries: je
    };
  }

  return {
    calculate,
    buildSchedule,
    computeEIR,
    solveYield,
    summarize,
    generateDIU,
    validate,
    HOLIDAY_CALENDARS,
    version: '1.0.0'
  };
}));

/* =========================================================
   Loan Module Integration Layer — Engine
   Extracted from income-calculator.html (single source of truth)
   Last sync: 2026-05-08
   ========================================================= */
const ONE_DAY = 86400000;
function toISO(d){ const z=new Date(d); z.setHours(12,0,0,0); return z.toISOString().slice(0,10); }
function parseISO(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y, m-1, d, 12); }
function addDays(d,n){ return new Date(d.getTime()+n*ONE_DAY); }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
function eachDay(from,to){ const out=[]; for(let d=new Date(from); d<=to; d=addDays(d,1)) out.push(new Date(d)); return out; }
function isLeap(y){ return (y%4===0 && y%100!==0) || y%400===0; }
function daysInYear(d){ return isLeap(d.getFullYear())?366:365; }
function sameDate(a,b){ return a && b && a.getTime()===b.getTime(); }

/* ---------- Day-count per-day accrual factor ---------- */
function dayCountFactor(basis, date){
  // Returns the fraction of year attributed to ONE calendar day.
  switch(basis){
    case 'ACT/360': return 1/360;
    case 'ACT/365': return 1/365;
    case 'ACT/ACT': return 1/daysInYear(date);
    case '30/360':  return 1/360; // simplified — for daily granularity 30/360 treats each day = 1/360
    default: return 1/360;
  }
}

/* ---------- Event lookup ---------- */
function eventsOn(date, events){
  const iso = toISO(date);
  return (events||[]).filter(e => e.date === iso);
}

/* ---------- Holiday calendars (Req 18) ----------
   Small curated set covering 2019-2031 for demo purposes. In production these
   would come from a calendar service (e.g. SIFMA, TARGET, Bank of England).
-------------------------------------------------- */
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
function isHoliday(date, calendarId){
  const cal = HOLIDAY_CALENDARS[calendarId] || HOLIDAY_CALENDARS.none;
  return cal.has(toISO(date));
}

/* ---------- Capitalization gate ---------- */
function isCapitalizationDay(date, anchor, freq){
  // Capitalization happens on the day-of-month of the anchor at the given frequency.
  if(!anchor) return false;
  if(date.getDate() !== anchor.getDate()) return false;
  const months = (date.getFullYear()-anchor.getFullYear())*12 + (date.getMonth()-anchor.getMonth());
  if(months <= 0) return false;
  if(freq==='Monthly')   return months % 1 === 0;
  if(freq==='Quarterly') return months % 3 === 0;
  if(freq==='Yearly')    return months % 12 === 0;
  return false;
}

/* ---------- IRR / yield solve (bisection, robust) ---------- */
function npv(rate, cashflows){
  // cashflows: [{t: yearsFromT0, amount}]
  let v=0; for(const cf of cashflows) v += cf.amount/Math.pow(1+rate, cf.t); return v;
}
function solveYield(targetNPV, cashflows){
  let lo=-0.99, hi=5.0;
  const f = r => npv(r, cashflows) - targetNPV;
  let fl=f(lo), fh=f(hi);
  if(fl*fh > 0) return null; // no sign change
  for(let i=0;i<200;i++){
    const mid=(lo+hi)/2, fm=f(mid);
    if(Math.abs(fm)<1e-9) return mid;
    if(fl*fm<0){ hi=mid; fh=fm; } else { lo=mid; fl=fm; }
  }
  return (lo+hi)/2;
}

/* ---------- Effective Interest Rate (EIR) solver ----------
   Returns a self-contained yield report for the instrument, computed
   independently of the amortization method selected. Fields:
     method          - the amort method actually driving book accretion
     effectiveYield  - the y used by the effective-interest family (or null)
     impliedYTM      - yield solved from (purchasePrice, projected coupon CFs,
                       face at maturity) — always computed for Fixed coupons
                       when PP≠Face; for Floating, uses current (index+spread).
     cashYield       - annual coupon / purchasePrice (current yield).
     totalReturn     - annualized (faceValue + totalCoupon - purchasePrice) / PP
     source          - 'price' | 'formula' | 'override' | 'implied' | 'par'
     note            - human-readable explanation.
   All yields are decimals (0.12 = 12%).
-------------------------------------------------------------- */
// Face-weighted aggregate EIR across tranches[] / underlyingLoans[].
// Returns null if no children resolved a non-zero coupon — caller handles fallback.
function aggregateChildEIRs(childResults, childRecords, kind){
  if(!childResults.length) return null;
  let totalFace = 0, weightedCoupon = 0, weightedYield = 0, withYield = 0;
  for(let i = 0; i < childResults.length; i++){
    const r = childResults[i];
    const f = (childRecords[i] && childRecords[i].faceValue) || 0;
    if(f <= 0) continue;
    totalFace += f;
    weightedCoupon += (r.couponRate || 0) * f;
    if(r.effectiveYield != null){
      weightedYield += r.effectiveYield * f;
      withYield += f;
    }
  }
  if(totalFace <= 0) return null;
  const couponRate = weightedCoupon / totalFace;
  const effectiveYield = withYield > 0 ? weightedYield / withYield : null;
  return {
    method: 'aggregated',
    couponRate,
    annualCoupon: totalFace * couponRate,
    effectiveYield,
    impliedYTM: null,
    cashYield: null,
    totalReturn: null,
    yearsToMat: childResults[0].yearsToMat,
    dayBasis: childResults[0].dayBasis,
    source: 'children',
    note: `Face-weighted across ${childResults.length} ${kind}${childResults.length === 1 ? '' : 's'} — coupon ${(couponRate*100).toFixed(4)}%`
  };
}

function computeEIR(instr){
  if(!instr) return null;

  // ---- Multi-tranche / guarantee wrapper handling ----------------------
  // For loans split into tranches[] (e.g. Suffolk Solar) compute a face-weighted
  // EIR across the children. For guarantees with underlyingLoans[] (Volt
  // Multi-Loan), do the same. The top-level coupon on these wrappers is
  // typically all zeros — the real rate lives on each child.
  if(Array.isArray(instr.tranches) && instr.tranches.length){
    const child = instr.tranches.map(t => {
      const merged = Object.assign({}, instr, t);
      delete merged.tranches; delete merged.underlyingLoans;   // prevent infinite recursion
      return computeEIR(merged);
    }).filter(x => x);
    return aggregateChildEIRs(child, instr.tranches, 'tranche');
  }
  if(Array.isArray(instr.underlyingLoans) && instr.underlyingLoans.length){
    const child = instr.underlyingLoans.map(u => {
      const merged = Object.assign({}, instr, u);
      delete merged.tranches; delete merged.underlyingLoans;
      return computeEIR(merged);
    }).filter(x => x);
    return aggregateChildEIRs(child, instr.underlyingLoans, 'underlying');
  }

  const settle   = parseISO(instr.settlementDate);
  const maturity = parseISO(instr.maturityDate);
  if(!settle || !maturity || maturity <= settle) return null;

  const basis = instr.dayBasis || 'ACT/360';
  const daysPerYear = (basis==='ACT/365' || basis==='ACT/ACT') ? 365 : 360;
  const totalDays = Math.round((maturity-settle)/ONE_DAY);
  const yearsToMat = totalDays / daysPerYear;

  const face = instr.faceValue || 0;
  const price = instr.purchasePrice || face;
  const amort = instr.amortization || { method:'none' };

  // ---- Current coupon rate -----------------------------------------------
  // Three coupon families:
  //   • Fixed                — uses coupon.fixedRate
  //   • Floating             — uses coupon.floatingRate + coupon.spread (legacy SOFR-style)
  //   • SONIA / SOFR / EURIBOR / FED / etc — RFR-driven, uses:
  //         rfr.baseRate                                     (the observed index level)
  //       + coupon.spread  OR  current marginSchedule entry  (the contractual margin)
  //       + ESG adjustment if enabled
  const c = instr.coupon || { type:'Fixed', fixedRate:0 };
  const RFR_TYPES = new Set(['SONIA','SOFR','ESTR','EURIBOR','TONA','FED']);
  let couponRate = 0;
  let rateBreakdown = '';
  if(c.type === 'Fixed'){
    couponRate = c.fixedRate || 0;
    rateBreakdown = `Fixed coupon ${(couponRate*100).toFixed(4)}%`;
  } else if(RFR_TYPES.has(c.type) || instr.rfr){
    const baseRate = instr.rfr?.baseRate ?? c.floatingRate ?? 0;
    let margin = c.spread ?? 0;
    // marginSchedule[] takes precedence if present (Libra 3, Volt, Suffolk)
    if(Array.isArray(instr.marginSchedule) && instr.marginSchedule.length){
      const todayISO = toISO(new Date());
      const inWindow = instr.marginSchedule.find(s =>
        (!s.from || s.from <= todayISO) && (!s.to || s.to >= todayISO)
      ) || instr.marginSchedule[0];
      if(inWindow){
        margin = (inWindow.marginBps != null) ? inWindow.marginBps / 10000 : (inWindow.spread || margin);
      }
    }
    let raw = baseRate + margin;
    if(c.floor != null) raw = Math.max(raw, c.floor);
    if(c.cap   != null) raw = Math.min(raw, c.cap);
    couponRate = raw;
    rateBreakdown = `${c.type || 'RFR'} ${(baseRate*100).toFixed(4)}% + margin ${(margin*100).toFixed(4)}% = ${(couponRate*100).toFixed(4)}%`;
  } else {
    // Legacy 'Floating' (SOFR-style) — explicit floatingRate + spread on coupon
    let raw = (c.floatingRate || 0) + (c.spread || 0);
    if(c.floor != null) raw = Math.max(raw, c.floor);
    if(c.cap   != null) raw = Math.min(raw, c.cap);
    couponRate = raw;
    rateBreakdown = `Floating ${((c.floatingRate||0)*100).toFixed(4)}% + spread ${((c.spread||0)*100).toFixed(4)}% = ${(couponRate*100).toFixed(4)}%`;
  }
  const annualCoupon = face * couponRate;

  // --- Implied YTM: annual coupons + balloon at maturity ---
  let impliedYTM = null;
  if(price > 0 && face > 0 && yearsToMat > 0){
    const cfs = [];
    const fullYears = Math.floor(yearsToMat);
    for(let y=1; y<=fullYears; y++) cfs.push({ t:y, amount: annualCoupon });
    const stub = yearsToMat - fullYears;
    cfs.push({ t: yearsToMat, amount: face + (stub>0 ? annualCoupon*stub : 0) });
    impliedYTM = solveYield(price, cfs);
  }

  // --- Effective yield actually driving amortization ---
  let effectiveYield = null, source = 'par', note = '';
  if(amort.method === 'effectiveInterestPrice'){
    effectiveYield = impliedYTM;
    source = 'price';
    note = 'Yield solved from purchase price vs. projected coupon cashflows.';
  } else if(amort.method === 'effectiveInterestFormula'){
    effectiveYield = couponRate + (amort.spread ?? 0);
    source = 'formula';
    note = `Yield = coupon (${(couponRate*100).toFixed(4)}%) + user spread (${((amort.spread||0)*100).toFixed(4)}%).`;
  } else if(amort.method === 'effectiveInterestIRR'){
    effectiveYield = amort.yieldOverride ?? couponRate;
    source = 'override';
    note = 'Yield override supplied by user.';
  } else if(amort.method === 'straightLine'){
    source = 'straightLine';
    note = 'Straight-line amortization — no effective yield; showing implied YTM for reference.';
  } else {
    source = price === face ? 'par' : 'implied';
    note = price === face
      ? 'Bond purchased at par — no amortization; cash yield equals coupon.'
      : 'No amortization method set — showing implied YTM for reference only.';
  }

  // --- Other useful yield metrics ---
  const cashYield   = price > 0 ? (annualCoupon / price) : null;
  const totalCoupon = annualCoupon * yearsToMat;
  const totalReturn = (price > 0 && yearsToMat > 0)
    ? ((face + totalCoupon - price) / price) / yearsToMat : null;

  // Prepend the rate breakdown to the note so the FV / EIR display shows base + margin.
  const fullNote = rateBreakdown ? `${rateBreakdown}${note ? ' · ' + note : ''}` : note;
  return {
    method: amort.method || 'none',
    couponRate, annualCoupon,
    effectiveYield, impliedYTM, cashYield, totalReturn,
    yearsToMat, dayBasis: basis, source, note: fullNote, rateBreakdown
  };
}

/* ---------- Core schedule builder ----------
   Walks the day grid from settlement → maturity and maintains:
     balance              (principal outstanding, includes PIK capitalizations)
     drawnBalance         (for revolvers: actually drawn portion)
     carryingValue        (used by effective-interest / straight-line methods)
     cumInterest, cumPIK  (tracker for capitalization)
-------------------------------------------------- */
function buildSchedule(instr){
  if(!instr) return [];

  // ---- Multi-tranche / multi-underlying support -------------------------
  // If instr.tranches is non-empty (a loan with fixed + floating tranches in
  // one transaction) OR instr.underlyingLoans is non-empty (a guarantee
  // covering multiple loans), recursively build a schedule per sub-instrument
  // and aggregate row-by-row. Each sub-instrument inherits the parent's
  // settlement/maturity and identifying fields unless overridden.
  // Closes scenarios #10 (fixed+floating mix) and G1 (multiple underlyings).
  const subs = (Array.isArray(instr.tranches) && instr.tranches.length)
    ? instr.tranches
    : (Array.isArray(instr.underlyingLoans) && instr.underlyingLoans.length)
      ? instr.underlyingLoans
      : null;
  if(subs){
    // Build schedule for each sub-instrument with parent context inherited
    const subSchedules = subs.map(s => {
      const merged = Object.assign({}, instr, s);
      // Don't recurse infinitely
      delete merged.tranches;
      delete merged.underlyingLoans;
      // Each sub keeps its own coupon, marginSchedule, principalSchedule, etc.
      return buildSchedule(merged);
    });
    // Aggregate row-by-row by date. Use the longest sub's date list as the
    // canonical day grid (all subs share parent settle/maturity so all grids
    // are equal length).
    const longest = subSchedules.reduce((a,b) => b.length > a.length ? b : a, subSchedules[0]);
    const aggregated = [];
    const SUM_KEYS = ['balance','drawnBalance','carryingValue','initialPurchase','draw','paydown',
                      'dailyCash','cumInterestAccrued','cumInterestEarned',
                      'capitalized','cashInterestPayment','dailyPik','cumPikAccrued','cumPikEarned',
                      'pikPaydown','amortDaily','cumAmort','nonUseFee','cumNonUseFee',
                      'dailyFees','dailyEIRAccretion','cumEIRAccretion',
                      'dailyDefaultInterest','dailyDefaultFee','cumDefaultInterest','cumDefaultFee'];
    for(let k = 0; k < longest.length; k++){
      const date = longest[k].date;
      const r = { date, jsDate: longest[k].jsDate, dayOfWeek: longest[k].dayOfWeek,
                  feeBreakdown: {}, hasEvent: false,
                  // weighted-average rate placeholders
                  couponRate: 0, floatingRate: 0, currentRate: 0, pikRate: 0 };
      for(const key of SUM_KEYS) r[key] = 0;
      let totalBal = 0;
      for(const sched of subSchedules){
        const sr = sched[k]; if(!sr) continue;
        for(const key of SUM_KEYS){ r[key] += (sr[key] || 0); }
        totalBal += (sr.balance || 0);
        r.hasEvent = r.hasEvent || sr.hasEvent;
        // merge per-fee breakdown
        if(sr.feeBreakdown){
          for(const [fk,fv] of Object.entries(sr.feeBreakdown)){
            r.feeBreakdown[fk] = (r.feeBreakdown[fk] || 0) + (fv || 0);
          }
        }
      }
      // Weighted-average rates by balance
      if(totalBal > 0){
        for(const sched of subSchedules){
          const sr = sched[k]; if(!sr || !sr.balance) continue;
          const w = sr.balance / totalBal;
          r.couponRate   += (sr.couponRate   || 0) * w;
          r.floatingRate += (sr.floatingRate || 0) * w;
          r.currentRate  += (sr.currentRate  || 0) * w;
          r.pikRate      += (sr.pikRate      || 0) * w;
        }
      }
      aggregated.push(r);
    }
    // Aggregate per-fee accumulation across sub-schedules
    const aggFeeBreakdown = [];
    const seen = new Map();
    for(const sched of subSchedules){
      for(const f of (sched.feeBreakdown || [])){
        const key = f.label;
        if(!seen.has(key)){
          seen.set(key, { label:f.label, ifrs:f.ifrs, cumAccrued: 0, cumRecognised: 0, cumPaid: 0 });
          aggFeeBreakdown.push(seen.get(key));
        }
        seen.get(key).cumAccrued += f.cumAccrued || 0;
      }
    }
    aggregated.feeBreakdown = aggFeeBreakdown;
    aggregated.deferredEIRPool = subSchedules.reduce((a,s) => a + (s.deferredEIRPool || 0), 0);
    aggregated.tranchesUsed = subs.map(s => s.id || s.label);
    return aggregated;
  }

  const settle   = parseISO(instr.settlementDate);
  const maturity = parseISO(instr.maturityDate);
  if(!settle || !maturity || maturity < settle) return [];

  const basis = instr.dayBasis || 'ACT/360';
  const events = (instr.principalSchedule||[]).slice().sort((a,b)=> a.date.localeCompare(b.date));

  // For revolvers / loans the "balance" starts at initial draw (first event w/ type=draw at settle) or faceValue.
  // Facility / deferred-drawdown case: if the principalSchedule has draws AFTER
  // settlement and NO initial/draw event at settlement, the loan starts at
  // zero balance (e.g. SP023 / Libra 2 — signed Oct 2024, first draw Feb 2026).
  const initialDraw = events.find(e => e.date===toISO(settle) && (e.type==='draw' || e.type==='initial'));
  const hasFutureDraws = events.some(e => e.type === 'draw' && e.date > toISO(settle));
  let balance;
  if(initialDraw)            balance = initialDraw.amount;
  else if(hasFutureDraws)    balance = 0;       // facility with deferred drawdown
  else                       balance = instr.faceValue || 0;
  let drawnBalance  = balance;
  const commitment  = instr.commitment ?? instr.faceValue;

  // Carrying value start = purchase price if given, else face
  let carryingValue = (instr.purchasePrice ?? instr.faceValue) || 0;

  // Precompute total life (years) and a rough cashflow set for IRR methods.
  // For SONIA / CompoundedRFR coupons the fixedRate is 0 — derive an
  // indicative coupon from the rfr base + first margin step + ESG adj so the
  // EIR solver can still project cashflows.
  const totalDays = Math.round((maturity-settle)/ONE_DAY);
  let couponRateNominal = instr.coupon?.fixedRate ?? 0;
  if(!couponRateNominal && (instr.coupon?.type === 'SONIA' || instr.coupon?.type === 'CompoundedRFR')){
    const rfrBase = instr.rfr?.baseRate ?? 0;
    const firstStep = (instr.marginSchedule || [])[0];
    const marginBps = firstStep?.marginBps ?? ((instr.coupon?.spread ?? 0) * 10000);
    const esgBps    = instr.esgAdjustment?.deltaBps ?? 0;
    couponRateNominal = rfrBase + (marginBps + esgBps)/10000;
  }

  // Effective interest yield (y):
  //   method effectiveInterestPrice  -> solve from PP
  //   method effectiveInterestFormula-> yield = coupon + spread (user-supplied)
  //   method effectiveInterestIRR    -> explicit yield input
  //   method straightLine            -> no y — amortize linearly
  let effectiveYield = null;
  const amort = instr.amortization || { method:'none' };
  // Days-per-year aligned with the day-count basis (keeps IRR-solve consistent with daily accrual).
  const daysPerYear = (basis==='ACT/365' || basis==='ACT/ACT') ? 365 : 360;
  if(amort.method === 'effectiveInterestPrice' && instr.purchasePrice && instr.faceValue && couponRateNominal){
    // Build cashflows aligned to the scheduler's day-count: coupon annually + face at maturity.
    const yearsToMat = totalDays / daysPerYear;
    const cfs = [];
    const coupon = instr.faceValue * couponRateNominal;
    const fullYears = Math.floor(yearsToMat);
    for(let y=1; y<=fullYears; y++) cfs.push({t:y, amount: coupon});
    const stub = yearsToMat - fullYears;
    cfs.push({t: yearsToMat, amount: instr.faceValue + (stub>0 ? coupon*stub : 0)});
    const seed = solveYield(instr.purchasePrice, cfs) ?? couponRateNominal;
    // Refinement pass: pick the yield that makes the daily-simple-interest schedule
    // close to face at maturity. Two-point secant is plenty.
    const runCarrying = (y) => {
      let cv = instr.purchasePrice || 0;
      for(let k=0; k<totalDays+1; k++){
        cv += cv * y * (1/daysPerYear) - instr.faceValue * couponRateNominal * (1/daysPerYear);
      }
      return cv;
    };
    let y0 = seed, y1 = seed * 1.001;
    let f0 = runCarrying(y0) - instr.faceValue;
    let f1 = runCarrying(y1) - instr.faceValue;
    for(let i=0; i<6 && Math.abs(f1) > 1e-3; i++){
      const y2 = y1 - f1 * (y1-y0) / (f1-f0);
      y0 = y1; f0 = f1; y1 = y2; f1 = runCarrying(y1) - instr.faceValue;
    }
    effectiveYield = y1;
  } else if(amort.method === 'effectiveInterestFormula'){
    effectiveYield = (couponRateNominal) + (amort.spread ?? 0);
  } else if(amort.method === 'effectiveInterestIRR'){
    effectiveYield = amort.yieldOverride ?? couponRateNominal;
  }

  // Discount/premium for straight-line
  const straightLineDaily = (amort.method==='straightLine' && instr.purchasePrice && instr.faceValue && totalDays>0)
    ? (instr.faceValue - instr.purchasePrice) / totalDays
    : 0;

  // PIK tracking (capitalize at anchor dates)
  const pikEnabled = !!instr.pik?.enabled;
  const pikRateNominal = instr.pik?.rate ?? 0;
  const capAnchor = settle;
  const capFreq = instr.pik?.capitalizationFrequency || 'Monthly';

  let cumCashAccrued = 0, cumPikAccrued = 0;
  let cumInterestEarned = 0, cumPikEarned = 0;
  let cumAmort = 0;
  let cumNonUseFee = 0;
  // ---- IFRS 9 ECL state -------------------------------------------------
  // ECL allowance is a contra-asset that grows toward the target ECL each day.
  // Target = (Stage 1 ? 12-month PD : lifetime PD) × LGD × EAD.
  // Daily ECL change = target - allowance, posted DR P&L / CR Loan Loss Allow.
  let eclAllowance = 0;
  let cumECLChange = 0;
  // ---- FX revaluation state ---------------------------------------------
  // Reval P&L is computed daily as opening-balance × (todayFX - yesterdayFX),
  // where FX = instrument currency → functional currency. fxRateSchedule
  // [{date, rate}] supplies date-effective fixings; default to 1.0.
  const fxScheduleSorted = (instr.fxRateSchedule || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  function fxRateOn(dateISO){
    if(!fxScheduleSorted.length) return 1.0;
    let r = fxScheduleSorted[0].rate;
    for(const step of fxScheduleSorted){
      if(step.date <= dateISO) r = step.rate;
      else break;
    }
    return r;
  }
  let prevFX = fxScheduleSorted[0]?.rate ?? 1.0;
  let cumFXGain = 0;
  // ---- IFRS 9 hedge accounting state ------------------------------------
  // hedge: { type:'CFH'|'FVH', notional, fixedRate, floatingRate,
  //          fairValueSchedule:[{date, mtm}], effectivenessRatio:0.95,
  //          settlementDates:[...] }
  // CFH: effective portion → cashFlowHedgeReserve (OCI 35000); ineffective → P&L (45100)
  // FVH: hedge MTM change → P&L (45200); offsetting hedged-item FV change → P&L
  // Reclassification on settlement: DR Hedge Reserve / CR P&L Hedge Income
  const hedgeFVSorted = ((instr.hedge?.fairValueSchedule) || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const hedgeSettlements = new Set((instr.hedge?.settlementDates) || []);
  let prevHedgeMTM = hedgeFVSorted[0]?.mtm ?? 0;
  let cashFlowHedgeReserve = 0;     // OCI accumulator (CFH only)
  let cumHedgeOCI = 0;              // total OCI movement to date
  let cumHedgePL  = 0;              // total P&L impact (effective for FVH, ineffective for CFH)
  let cumHedgeReclass = 0;          // reserve reclassified to P&L on settlements (CFH)
  function hedgeMTMOn(dateISO){
    if(!hedgeFVSorted.length) return 0;
    let m = hedgeFVSorted[0].mtm;
    for(const step of hedgeFVSorted){
      if(step.date <= dateISO) m = step.mtm;
      else break;
    }
    return m;
  }

  // ---- Fee accrual setup (multi-fee) ----------------------------------
  // instr.fees: [{ id, kind, label, mode, rate, base, amount, frequency,
  //                paymentDate, ifrs, accrueFrom, accrueTo }]
  //   kind        : arrangement | commitment | guarantee | other
  //   mode        : 'percent' (rate × base × dcf) | 'flat' (amount on paymentDate)
  //   base        : commitment | undrawn | drawn | covered | face
  //   ifrs        : IFRS9-EIR | IFRS15-overTime | IFRS15-pointInTime
  //   frequency   : oneOff | daily | monthly | quarterly | semiAnnual | annual
  // EIR-classified fees (IFRS 9) accrete into carrying value as deferred
  // income; recognised pro-rata over the life. IFRS 15 fees are recognised
  // over the service period (commitment/guarantee) or at the point-in-time.
  const fees = Array.isArray(instr.fees) ? instr.fees : [];
  const feeAccum = fees.map(f => ({
    id: f.id, kind: f.kind, label: f.label || f.kind, ifrs: f.ifrs || 'IFRS15-overTime',
    cumAccrued: 0, cumRecognised: 0, cumPaid: 0
  }));
  const totalLifeDays = Math.max(1, Math.round((maturity - settle)/ONE_DAY));
  // For IFRS9-EIR fees: deferred income at t0 = sum(flat one-off) + 0 (% accrue daily over life)
  let deferredEIRPool = 0;
  for(const f of fees){
    if(f.ifrs === 'IFRS9-EIR' && f.mode === 'flat' && f.frequency === 'oneOff'){
      deferredEIRPool += (f.amount || 0);
      // Reduce initial carrying value by the deferred fee (cash received at signing
      // is offset against carrying amount; it accretes back into interest income).
      carryingValue -= (f.amount || 0);
    } else if(f.ifrs === 'IFRS9-EIR' && f.mode === 'percent' && f.frequency === 'oneOff'){
      const baseAmt = ((b)=>{
        if(b==='commitment') return commitment;
        if(b==='face')       return instr.faceValue || 0;
        if(b==='drawn')      return drawnBalance;
        if(b==='covered')    return instr.coveredAmount || 0;
        return commitment;
      })(f.base);
      const oneOff = baseAmt * (f.rate || 0);
      deferredEIRPool += oneOff;
      carryingValue -= oneOff;
    }
  }
  const eirDailyAccretion = deferredEIRPool > 0 ? (deferredEIRPool / totalLifeDays) : 0;

  // ---- SONIA / margin ratchet helpers ---------------------------------
  // instr.marginSchedule: [{ from: ISO, to: ISO|null, marginBps: number }]
  // instr.esgAdjustment : { from: ISO, deltaBps: number }   (e.g., -2.5)
  // instr.rfr            : { index, baseRate, lookbackDays, rounding }
  function lookupMarginBps(dateISO){
    const ms = instr.marginSchedule || [];
    for(const m of ms){
      const f = m.from || '0000-01-01';
      const t = m.to   || '9999-12-31';
      if(dateISO >= f && dateISO <= t) return m.marginBps;
    }
    return null;
  }
  function esgDeltaBps(dateISO){
    const e = instr.esgAdjustment;
    if(!e || !e.from) return 0;
    return dateISO >= e.from ? (e.deltaBps || 0) : 0;
  }

  const rows = [];
  const days = eachDay(settle, maturity);
  for(let i=0; i<days.length; i++){
    const d = days[i];

    // ----- Apply events first (draws, paydowns) -----
    const evs = eventsOn(d, events);
    let draw=0, paydown=0, initial=0;
    for(const e of evs){
      if(e.type==='initial'){ initial += e.amount; /* already counted into starting balance */ }
      else if(e.type==='draw'){ draw += e.amount; balance += e.amount; drawnBalance += e.amount; carryingValue += e.amount; }
      // 'repayment' is an alias for 'paydown' used by guarantee / equity-fund
      // examples — semantically clearer when reading the schedule.
      else if(e.type==='paydown' || e.type==='repayment'){ paydown += e.amount; balance -= e.amount; drawnBalance -= e.amount; carryingValue -= e.amount; }
    }

    // ----- IFRS 9 modification accounting (§5.4.3) -----------------------
    // modificationEvents: [{date, modType, gainLoss, newCoupon, newMaturity,
    //                       newSchedule, reason, pvDelta}]
    // Substantial mod (≥10% PV change) → derecognise + new instrument (the
    // engine logs the event and applies new terms forward; full derecog/re-
    // recog requires splitting into two instruments which we surface in DIU).
    // Non-substantial → adjust carrying value + post P&L gain/loss.
    let dailyModGain = 0;
    let modEventDescription = null;
    const dISO = toISO(d);
    for(const mev of (instr.modificationEvents || [])){
      if(mev.date !== dISO) continue;
      const gainLoss = mev.gainLoss || 0;
      dailyModGain += gainLoss;
      modEventDescription = (mev.modType === 'substantial' ? 'Substantial' : 'Non-substantial')
                          + ' modification' + (mev.reason ? ' — ' + mev.reason : '');
      // Apply forward-looking term changes
      if(mev.newCoupon){
        instr.coupon = Object.assign({}, instr.coupon || {}, mev.newCoupon);
      }
      if(mev.newMaturity){
        // Note: maturity change mid-life only takes effect for accrual purposes
        // beyond this date. The day grid was fixed at loop start so we won't
        // extend rows — set a flag for the user.
        instr.maturityDate = mev.newMaturity;
      }
      // For non-substantial mods, adjust carrying value by gain/loss (P&L pair posted via DIU)
      if(mev.modType !== 'substantial' && gainLoss){
        carryingValue += gainLoss;
      }
    }

    // ----- Determine effective coupon rate for today -----
    let couponRate = instr.coupon?.fixedRate ?? 0;
    let floatingRate = instr.coupon?.floatingRate ?? 0;
    const todayISO = toISO(d);
    if(instr.coupon?.type === 'Floating'){
      // Apply spread + cap/floor
      let r = floatingRate + (instr.coupon.spread ?? 0);
      if(instr.coupon.floor != null) r = Math.max(r, instr.coupon.floor);
      if(instr.coupon.cap   != null) r = Math.min(r, instr.coupon.cap);
      couponRate = r;
    } else if(instr.coupon?.type === 'SONIA' || instr.coupon?.type === 'CompoundedRFR'){
      // RFR (SONIA) + ratcheted margin + optional ESG adjustment.
      // Lookback period is informational here; we use today's RFR fix.
      const rfrBase = (instr.rfr?.baseRate ?? floatingRate) || 0;
      const baseMarginBps = lookupMarginBps(todayISO);
      const marginBps = (baseMarginBps != null ? baseMarginBps : (instr.coupon.spread ?? 0)*10000)
                       + esgDeltaBps(todayISO);
      let r = rfrBase + marginBps/10000;
      if(instr.coupon.floor != null) r = Math.max(r, instr.coupon.floor);
      if(instr.coupon.cap   != null) r = Math.min(r, instr.coupon.cap);
      couponRate = r;
    }

    // ----- Holiday skip (Req 18): when enabled, zero the day-count factor on holidays -----
    const onHoliday = instr.holidayCalendar && instr.holidayCalendar!=='none' && isHoliday(d, instr.holidayCalendar);
    const skipToday = !!(instr.skipHolidays && onHoliday);

    // ----- Amortization window (Req 10): only amortize inside [amortStart, amortEnd] if set -----
    const amortStart = instr.amortStart ? parseISO(instr.amortStart) : settle;
    const amortEnd   = instr.amortEnd   ? parseISO(instr.amortEnd)   : maturity;
    const inAmortWindow = d >= amortStart && d <= amortEnd;

    // ----- Day count factor -----
    const dcf = skipToday ? 0 : dayCountFactor(basis, d);

    // ----- Daily cash accrual -----
    // For guarantee / equity instruments NWF does not earn the underlying
    // loan's coupon (only fees / dividends), so suppress interest accrual.
    // The coupon rate stays on the row for reference (drives the underlying
    // loan's behaviour and any rate-linked guarantee fee calcs).
    const noInterest = instr.instrumentKind === 'guarantee'
                    || instr.instrumentKind === 'equity-fund'
                    || instr.instrumentKind === 'equity-direct';
    const dailyCash = noInterest ? 0 : (balance * couponRate * dcf);
    cumCashAccrued += dailyCash;
    cumInterestEarned += dailyCash;

    // ----- Default interest / default fee accrual -----
    // instr.defaultEvents: [{date, kind:'missedPayment'|'covenantBreach',
    //                        defaultRateBps, defaultFeeAmount, endDate?, reason}]
    // From the event date (until endDate or maturity) the engine adds
    // defaultRateBps × balance × dcf as additional default interest, and
    // recognises defaultFeeAmount as a one-off default fee on the event date.
    let dailyDefaultInterest = 0;
    let dailyDefaultFee = 0;
    if(Array.isArray(instr.defaultEvents)){
      for(const ev of instr.defaultEvents){
        if(!ev.date) continue;
        const evEnd = ev.endDate || toISO(maturity);
        if(todayISO >= ev.date && todayISO <= evEnd && ev.defaultRateBps){
          dailyDefaultInterest += balance * (ev.defaultRateBps/10000) * dcf;
        }
        if(todayISO === ev.date && ev.defaultFeeAmount){
          dailyDefaultFee += ev.defaultFeeAmount;
        }
      }
    }

    // ----- Daily PIK accrual -----
    let dailyPik = 0;
    if(pikEnabled){
      dailyPik = balance * pikRateNominal * dcf;
      cumPikAccrued += dailyPik;
      cumPikEarned  += dailyPik;
    }

    // ----- IFRS 9 ECL provisioning ---------------------------------------
    // Target ECL based on stage:
    //   Stage 1: 12-month ECL  =  pdAnnual × lgd × balance
    //   Stage 2: lifetime ECL  =  min(1, pdAnnual × yearsRemaining) × lgd × balance
    //   Stage 3: lifetime ECL on net carrying (= gross - existing allowance)
    // Daily change = target - allowance (positive grows allowance, negative reverses).
    let dailyECLChange = 0;
    if(instr.ifrs && instr.ifrs.computeECL !== false){
      const stage = instr.ifrs.ecLStage || 1;
      const pdAnn = instr.ifrs.pdAnnual || 0;
      const lgd   = instr.ifrs.lgd || 0;
      if(pdAnn > 0 && lgd > 0 && balance > 0){
        const yrsRemaining = Math.max(0, (maturity - d) / (365 * ONE_DAY));
        let lifetimePD = Math.min(1, pdAnn * yrsRemaining);
        let targetECL;
        if(stage === 1){
          targetECL = balance * pdAnn * lgd;
        } else if(stage === 2){
          targetECL = balance * lifetimePD * lgd;
        } else {
          // Stage 3 — credit-impaired: lifetime ECL on net carrying
          const netCarrying = Math.max(0, balance - eclAllowance);
          targetECL = netCarrying * lifetimePD * lgd + eclAllowance;
          // Clamp so the net allowance stays sane
          targetECL = Math.min(balance, targetECL);
        }
        dailyECLChange = targetECL - eclAllowance;
        eclAllowance += dailyECLChange;
        cumECLChange += dailyECLChange;
      }
    }

    // ----- FX revaluation ------------------------------------------------
    // Revalue OPENING balance at today's rate vs prior day's rate. Flow
    // changes on the day (draws/repayments) get booked at today's FX so they
    // don't generate FX P&L themselves.
    const todayFX = fxRateOn(todayISO);
    const dailyFXGain = (i === 0) ? 0 : (balance - draw + paydown) * (todayFX - prevFX);
    // (balance - draw + paydown) reconstructs the opening balance: today's
    // closing balance was already adjusted for the day's flows above.
    cumFXGain += dailyFXGain;
    prevFX = todayFX;

    // ----- IFRS 9 hedge accounting (§6) --------------------------------
    // Daily hedge MTM change is split into effective (OCI for CFH) and
    // ineffective (P&L for both CFH and FVH). For FVH the entire change is
    // P&L because it directly offsets the hedged item's FV movements.
    let dailyHedgeOCI = 0;          // CFH effective portion
    let dailyHedgePL  = 0;          // ineffective (CFH) or full hedge MTM (FVH)
    let dailyHedgeReclass = 0;      // CFH reclassification to P&L on settlement
    let hedgeEffectiveness = null;  // 80-125% test indicator
    if(instr.hedge && instr.hedge.type){
      const effRatio = instr.hedge.effectivenessRatio ?? 0.95;
      const todayMTM = hedgeMTMOn(dISO);
      const dMTM = (i === 0) ? 0 : todayMTM - prevHedgeMTM;
      prevHedgeMTM = todayMTM;
      if(instr.hedge.type === 'CFH'){
        // Cash flow hedge: effective portion to OCI, ineffective to P&L
        dailyHedgeOCI = dMTM * effRatio;
        dailyHedgePL  = dMTM * (1 - effRatio);
        cashFlowHedgeReserve += dailyHedgeOCI;
        // Reclassify reserve to P&L on settlement dates (when hedged cashflow occurs)
        if(hedgeSettlements.has(dISO) && cashFlowHedgeReserve !== 0){
          dailyHedgeReclass = cashFlowHedgeReserve;
          cashFlowHedgeReserve = 0;
        }
      } else if(instr.hedge.type === 'FVH'){
        // Fair value hedge: full MTM change to P&L
        dailyHedgePL = dMTM;
      }
      // Effectiveness ratio test — must be in 80-125% range under IFRS 9
      // (legacy IAS 39 numerical test; IFRS 9 §6.4.1 only requires economic
      // relationship + dominant credit risk, but we surface the ratio for
      // diagnostic purposes).
      hedgeEffectiveness = effRatio;
      cumHedgeOCI += dailyHedgeOCI;
      cumHedgePL  += dailyHedgePL;
      cumHedgeReclass += dailyHedgeReclass;
    }

    // ----- Non-use fee (on undrawn commitment) -----
    let dailyNonUse = 0;
    if(instr.nonUseFee?.enabled && commitment > drawnBalance){
      dailyNonUse = (commitment - drawnBalance) * (instr.nonUseFee.rate ?? 0) * dcf;
      cumNonUseFee += dailyNonUse;
    }

    // ----- Multi-fee daily accrual (IFRS 9 / 15 aware) -----
    // Each fee accrues on its own base × rate × dcf when in-window. EIR-classified
    // fees feed deferredEIRPool (one-off side already booked at t0); the pool
    // accretes daily into interest income (via carryingValue accretion). IFRS 15
    // fees recognise income directly on the fee line.
    let dailyFees = 0;
    const dailyFeeBreakdown = {};
    for(let fi=0; fi<fees.length; fi++){
      const f = fees[fi];
      const acc = feeAccum[fi];
      const accFrom = f.accrueFrom ? parseISO(f.accrueFrom) : settle;
      const accTo   = f.accrueTo   ? parseISO(f.accrueTo)   : maturity;
      if(d < accFrom || d > accTo) continue;
      let amt = 0;
      // One-off fees (arrangement, structuring) are captured into the
      // deferredEIRPool at t0 — skip the daily accrual loop entirely so
      // they don't double-count. They surface via dailyEIRAccretion (IFRS 9)
      // or as a point-in-time recognition row on paymentDate (IFRS 15).
      if(f.frequency === 'oneOff') {
        // Point-in-time IFRS 15: recognise the full amount on paymentDate.
        if(f.ifrs === 'IFRS15-pointInTime' && f.paymentDate && toISO(d) === f.paymentDate){
          if(f.mode === 'percent'){
            const baseAmt = (b => {
              if(b==='commitment') return commitment;
              if(b==='face')       return instr.faceValue || 0;
              if(b==='drawn')      return drawnBalance;
              if(b==='covered')    return instr.coveredAmount || 0;
              return commitment;
            })(f.base || 'commitment');
            amt = baseAmt * (f.rate || 0);
          } else {
            amt = f.amount || 0;
          }
        }
        // IFRS9-EIR / IFRS15-overTime one-offs: skip — already in EIR pool.
      } else if(f.mode === 'percent' || f.mode === 'marginLinked'){
        // Per-fee rate ratchet: if feeRateSchedule = [{from,to,rate}] is set,
        // resolve today's rate from the schedule (otherwise fall back to f.rate).
        // Closes scenario #14 (commitment fee % ratchets) and G3 (time-based
        // guarantee fee adjustments) — works for any percent-mode fee.
        let effectiveRate = f.rate || 0;
        if(Array.isArray(f.feeRateSchedule) && f.feeRateSchedule.length){
          for(const step of f.feeRateSchedule){
            const fr = step.from || '0000-01-01';
            const to = step.to   || '9999-12-31';
            if(todayISO >= fr && todayISO <= to){ effectiveRate = step.rate; break; }
          }
        }
        // For guarantee instruments, "drawn" / "undrawn" naturally refer to
        // the covered tranche, not the full facility. Fall back to commitment-
        // based for non-guarantee loans so existing behaviour is preserved.
        const isGuar = instr.instrumentKind === 'guarantee';
        const cap = isGuar && instr.coveredAmount ? instr.coveredAmount : commitment;
        const baseAmt = (b => {
          if(b==='commitment') return commitment;
          if(b==='undrawn')    return Math.max(0, cap - drawnBalance);
          if(b==='drawn')      return Math.min(drawnBalance, cap);
          if(b==='covered')    return instr.coveredAmount || 0;
          if(b==='face')       return instr.faceValue || 0;
          return cap;
        })(f.base || 'undrawn');
        if(f.mode === 'marginLinked'){
          // UK convention: commitment fee = marginMultiple × current margin × undrawn × dcf.
          // Margin includes ESG adjustment so the fee tracks the contractual
          // economics. marginMultiple defaults to 0.35 (35%).
          const baseMarginBps = lookupMarginBps(todayISO);
          const marginBps = (baseMarginBps != null ? baseMarginBps
                              : (instr.coupon?.spread ?? 0) * 10000)
                            + esgDeltaBps(todayISO);
          const eff = (marginBps/10000) * (f.marginMultiple ?? 0.35);
          amt = baseAmt * eff * dcf;
        } else {
          amt = baseAmt * effectiveRate * dcf;
        }
      } else if(f.mode === 'flat'){
        // Spread flat amount linearly across accrual window
        const lifeDays = Math.max(1, Math.round((accTo - accFrom)/ONE_DAY) + 1);
        amt = (f.amount || 0) / lifeDays;
      }
      if(amt){
        acc.cumAccrued += amt;
        dailyFees += amt;
        dailyFeeBreakdown[acc.label] = (dailyFeeBreakdown[acc.label]||0) + amt;
      }
    }

    // ----- EIR accretion of deferred IFRS 9 fees -----
    // Deferred income (from arrangement / OID-style fees) accretes back into
    // interest income via increasing the carrying value daily.
    let dailyEIRAccretion = 0;
    if(eirDailyAccretion > 0){
      dailyEIRAccretion = eirDailyAccretion;
      carryingValue += dailyEIRAccretion;
    }

    // ----- Capitalization (PIK) -----
    let capitalized = 0;
    if(pikEnabled && isCapitalizationDay(d, capAnchor, capFreq) && cumPikAccrued > 0){
      capitalized = cumPikAccrued;
      balance += capitalized;
      carryingValue += capitalized;
      cumPikAccrued = 0; // reset accrued pool
    }

    // ----- Amortization of discount/premium -----
    let dailyAmort = 0;
    if(inAmortWindow){
      if(amort.method === 'straightLine'){
        dailyAmort = straightLineDaily;
        carryingValue += dailyAmort;
        cumAmort += dailyAmort;
      } else if(effectiveYield != null){
        // effective interest: daily yield accrual on carrying value
        const dyield = effectiveYield * dcf;
        const effectiveIncome = carryingValue * dyield;
        dailyAmort = effectiveIncome - dailyCash; // portion that amortizes discount/premium
        carryingValue += dailyAmort;
        cumAmort += dailyAmort;
      }
    }

    rows.push({
      date: toISO(d),
      jsDate: d,
      dayOfWeek: d.getDay(),
      balance,
      drawnBalance,
      carryingValue,
      initialPurchase: initial || 0,
      draw,
      paydown,
      couponRate,
      floatingRate,
      currentRate: couponRate,
      dailyCash,
      cumInterestAccrued: cumCashAccrued,
      cumInterestEarned,
      capitalized,
      interestAdjustments: 0,
      cashInterestPayment: 0,
      pikRate: pikEnabled ? pikRateNominal : 0,
      dailyPik,
      cumPikAccrued,
      cumPikEarned,
      pikInterestAdjustments: 0,
      pikPaydown: 0,
      amortDaily: dailyAmort,
      cumAmort,
      nonUseFee: dailyNonUse,
      cumNonUseFee,
      // IFRS-aware fee fields
      dailyFees,
      feeBreakdown: dailyFeeBreakdown,
      dailyEIRAccretion,
      cumEIRAccretion: (rows.length ? rows[rows.length-1].cumEIRAccretion : 0) + dailyEIRAccretion,
      // Default interest / default fee
      dailyDefaultInterest,
      dailyDefaultFee,
      cumDefaultInterest: (rows.length ? rows[rows.length-1].cumDefaultInterest : 0) + dailyDefaultInterest,
      cumDefaultFee:      (rows.length ? rows[rows.length-1].cumDefaultFee : 0) + dailyDefaultFee,
      // ECL provisioning (IFRS 9 §5.5)
      dailyECLChange,
      eclAllowance,
      cumECLChange,
      // Modification accounting (IFRS 9 §5.4.3)
      dailyModGain,
      modEventDescription,
      cumModGain: (rows.length ? rows[rows.length-1].cumModGain : 0) + dailyModGain,
      // FX revaluation
      fxRate: todayFX,
      dailyFXGain,
      cumFXGain,
      balanceFC: balance * todayFX,                       // balance in functional currency
      // Hedge accounting (IFRS 9 §6)
      dailyHedgeOCI, dailyHedgePL, dailyHedgeReclass,
      cashFlowHedgeReserve, cumHedgeOCI, cumHedgePL, cumHedgeReclass,
      hedgeEffectiveness,
      hasEvent: evs.length > 0 || capitalized > 0 || dailyDefaultFee > 0
    });
  }
  // Stash the engine's applied yield so computeEIR can align its effectiveYield
  // with the value the scheduler actually used.
  rows.effectiveYield = effectiveYield;
  rows.feeBreakdown   = feeAccum;          // per-fee cumulative accrual
  rows.deferredEIRPool = deferredEIRPool;  // total IFRS-9 deferred income at t0
  return rows;
}

/* ---------- Window summariser ---------- */
function summarize(rows, beginISO, endISO){
  const win = rows.filter(r => r.date >= beginISO && r.date <= endISO);
  const sum = (arr, k) => arr.reduce((a,r)=> a + (r[k]||0), 0);
  // Build a per-fee breakdown for the window by walking each day's
  // feeBreakdown map and aggregating by label.
  const feeBreakdown = {};
  for(const r of win){
    if(r.feeBreakdown){
      for(const [k,v] of Object.entries(r.feeBreakdown)){
        feeBreakdown[k] = (feeBreakdown[k] || 0) + (v || 0);
      }
    }
  }
  return {
    rows: win,
    totalCashAccrual: sum(win,'dailyCash'),
    totalPikAccrual:  sum(win,'dailyPik'),
    totalCapitalized: sum(win,'capitalized'),
    totalAmort:       sum(win,'amortDaily'),
    totalNonUseFee:   sum(win,'nonUseFee'),
    totalFees:        sum(win,'dailyFees'),
    totalEIRAccretion: sum(win,'dailyEIRAccretion'),
    totalDefaultInterest: sum(win,'dailyDefaultInterest'),
    totalDefaultFee:      sum(win,'dailyDefaultFee'),
    totalDraws:           sum(win,'draw'),
    totalRepayments:      sum(win,'paydown'),
    totalECLChange:       sum(win,'dailyECLChange'),
    closingECLAllowance:  win[win.length-1]?.eclAllowance ?? 0,
    totalFXGain:          sum(win,'dailyFXGain'),
    closingBalanceFC:     win[win.length-1]?.balanceFC ?? 0,
    totalModGain:         sum(win,'dailyModGain'),
    modEvents:            win.filter(r => r.modEventDescription).map(r => ({date: r.date, description: r.modEventDescription, gainLoss: r.dailyModGain})),
    totalHedgeOCI:        sum(win,'dailyHedgeOCI'),
    totalHedgePL:         sum(win,'dailyHedgePL'),
    totalHedgeReclass:    sum(win,'dailyHedgeReclass'),
    closingHedgeReserve:  win[win.length-1]?.cashFlowHedgeReserve ?? 0,
    feeBreakdown,                  // { 'Arrangement Fee': 12345.67, ... }
    daysCount:        win.length,
    openingBalance:   win[0]?.balance ?? 0,
    closingBalance:   win[win.length-1]?.balance ?? 0,
    closingCarrying:  win[win.length-1]?.carryingValue ?? 0,
    periodStart:      win[0]?.date,
    periodEnd:        win[win.length-1]?.date
  };
}

/* ---------- Cash flow forecast & maturity ladder ----------
   Project daily flows from `asOfDate` forward into bucketed maturity ladders.
   Standard IFRS 7 liquidity disclosure buckets:
     ≤30d, 31-90d, 91-180d, 181d-1yr, 1-5yr, >5yr.
   Each bucket sums the principal repayments, interest, fees, and EIR
   accretion expected to settle in that window.
*/
function buildCashFlowForecast(rows, asOfISO){
  if(!rows || !rows.length) return null;
  const asOfDate = parseISO(asOfISO);
  if(!asOfDate) return null;
  const D = ms => Math.floor(ms / ONE_DAY);
  const cutoffs = [
    { label:'≤30d',     maxDays: 30  },
    { label:'31-90d',   maxDays: 90  },
    { label:'91-180d',  maxDays: 180 },
    { label:'181d-1yr', maxDays: 365 },
    { label:'1-5yr',    maxDays: 365 * 5 },
    { label:'>5yr',     maxDays: Infinity }
  ];
  // Initialise buckets
  const buckets = cutoffs.map((c, ix) => ({
    label: c.label,
    fromDays: ix === 0 ? 0 : cutoffs[ix-1].maxDays + 1,
    toDays:   c.maxDays,
    principal: 0, interest: 0, fees: 0, eir: 0, defaultInt: 0, total: 0,
    rowsCount: 0
  }));
  let totalPrincipal=0, totalInterest=0, totalFees=0, totalEIR=0, totalDefault=0;
  for(const r of rows){
    const rd = parseISO(r.date);
    if(rd < asOfDate) continue;
    const days = D(rd - asOfDate);
    const b = buckets.find(b => days >= b.fromDays && days <= b.toDays);
    if(!b) continue;
    const principal = (r.paydown || 0);
    const interest  = (r.dailyCash || 0);
    const fees      = (r.dailyFees || 0);
    const eir       = (r.dailyEIRAccretion || 0);
    const defaultInt= (r.dailyDefaultInterest || 0);
    b.principal += principal; b.interest += interest; b.fees += fees;
    b.eir += eir; b.defaultInt += defaultInt;
    b.total += principal + interest + fees + eir + defaultInt;
    b.rowsCount++;
    totalPrincipal += principal; totalInterest += interest; totalFees += fees;
    totalEIR += eir; totalDefault += defaultInt;
  }
  return {
    asOf: asOfISO,
    buckets,
    totals: {
      principal: totalPrincipal, interest: totalInterest, fees: totalFees,
      eirAccretion: totalEIR, defaultInterest: totalDefault,
      grandTotal: totalPrincipal + totalInterest + totalFees + totalEIR + totalDefault
    }
  };
}

/* ---------- Inline reference sample (SP023 / Libra 2) -----------------
   Embedded so the "Load sample" button works without a fetch — useful when
   the calculator is opened from file:// where same-directory JSON fetches
   may be blocked by the browser.
*/
const RECON_SAMPLE_LIBRA2 = {
  source: 'Reference Software X · SP023 Libra 2',
  exportedAt: '2026-04-30T16:00:00Z',
  matchKey: 'date',
  tolerances: { balance: 1.00, interest: 0.10, fees: 0.10, totalCash: 0.10, breakThresholdPct: 0.5 },
  instrument: { id: 'libra2', legalEntity: 'NWF Sustainable Infrastructure', deal: 'Libra 2',
                position: 'NWF 100% Bilateral Position · Libra 2',
                incomeSecurity: 'HSBC Facility B4 — Libra 2 (Compounded SONIA + Ratcheted Margin)' },
  scheduleResults: [
    { date:'2024-10-13', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees: 437500.00, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:0,        comment:'Arrangement fee 1.75% × £25M paid 13/10/2024' },
    { date:'2025-01-10', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  88219.18, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q1 commitment fee · 25M × 35% × 4.0% × 92/365' },
    { date:'2025-04-10', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  87679.79, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q2 — margin 4.00% → 4.25% mid-period' },
    { date:'2025-07-10', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  92420.38, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q3 — margin 4.50%, ESG -25 bps from 22/5' },
    { date:'2025-10-10', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  93181.51, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q4 — full quarter at 4.475% effective' },
    { date:'2026-01-12', openingBalance:0, closingBalance:0, interestAccrued:0, totalFees:  95207.19, drawdown:0, repayment:0, utilisation:0, totalFacility:25000000, undrawnAmount:25000000, comment:'Q5 — date adjusted forward (modified following)' },
    { date:'2026-04-01', openingBalance:0, closingBalance:25000000, interestAccrued:0, totalFees:0, drawdown:25000000, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0, comment:'£25M drawdown · single tranche per reference modelling' },
    { date:'2026-04-10', openingBalance:25000000, closingBalance:25000000, interestAccrued:0, totalFees:80937.50, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0, comment:'Stub commitment fee 12/01 → 31/03' },
    { date:'2026-07-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:499006.92, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0, comment:'First quarterly interest post-drawdown' },
    { date:'2026-10-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:497482.15, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 },
    { date:'2027-01-04', openingBalance:25000000, closingBalance:25000000, interestAccrued:511904.02, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 },
    { date:'2027-04-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:469317.48, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 },
    { date:'2027-07-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:507740.36, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 },
    { date:'2027-10-01', openingBalance:25000000, closingBalance:25000000, interestAccrued:515037.06, totalFees:0, drawdown:0, repayment:0, utilisation:1, totalFacility:25000000, undrawnAmount:0 }
  ]
};

/* ---------- Reconciliation engine -------------------------------------
   Compare our calculator's daily schedule against PortF reference data's
   period-by-period results (interest, fees, balance, etc.) and surface
   per-row diffs with status (tied / within tolerance / break) plus
   summary KPIs. Tolerances and break thresholds are configurable in the
   reference JSON; sensible defaults below.
*/
const RECON_DEFAULT_TOLERANCES = {
  balance: 1.00,
  interest: 0.10,
  fees: 0.10,
  totalCash: 0.10,
  breakThresholdPct: 0.5
};

function reconcileAgainstReference(rows, referenceData){
  if(!rows || !rows.length || !referenceData || !Array.isArray(referenceData.scheduleResults)) return null;
  const tol = Object.assign({}, RECON_DEFAULT_TOLERANCES, referenceData.tolerances || {});
  // Fast lookup: map calculator rows by date (ISO)
  const ourByDate = new Map();
  for(const r of rows) ourByDate.set(r.date, r);
  // For each reference period, find the matching day in our schedule.
  // The reference rows are typically end-of-period; we sum our daily flows
  // since the previous reference date for a period-to-period comparison.
  const sortedRef = referenceData.scheduleResults.slice()
    .sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  let prevDate = null;
  const compared = [];
  for(const ref of sortedRef){
    const ourRow = ourByDate.get(ref.date);
    // Sum our daily flows from prevDate (exclusive) to ref.date (inclusive)
    // for period-style comparisons (interest, fees, drawdown, repayment).
    let ourInterest = 0, ourFees = 0, ourDraw = 0, ourPaydown = 0;
    if(prevDate){
      for(const r of rows){
        if(r.date > prevDate && r.date <= ref.date){
          ourInterest += r.dailyCash || 0;
          ourFees     += r.dailyFees || 0;
          ourDraw     += r.draw || 0;
          ourPaydown  += r.paydown || 0;
        }
      }
    } else {
      // First reference row — sum from start through ref.date
      for(const r of rows){
        if(r.date <= ref.date){
          ourInterest += r.dailyCash || 0;
          ourFees     += r.dailyFees || 0;
          ourDraw     += r.draw || 0;
          ourPaydown  += r.paydown || 0;
        }
      }
    }
    const ourBalance = ourRow ? ourRow.balance : null;
    const lines = [];
    const checkLine = (metric, refVal, ourVal, tolerance) => {
      if(refVal == null && ourVal == null) return;
      if(refVal == null) refVal = 0;
      if(ourVal == null) ourVal = 0;
      const diff = ourVal - refVal;
      const absDiff = Math.abs(diff);
      const denom = Math.abs(refVal) || Math.abs(ourVal) || 1;
      const pct = denom > 0 ? Math.abs(diff)/denom : 0;
      let status;
      if(absDiff <= tolerance)                                  status = 'tied';
      else if(pct * 100 <= tol.breakThresholdPct)               status = 'within';
      else                                                       status = 'break';
      lines.push({ metric, ref: refVal, ours: ourVal, diff, pct, status, tolerance });
    };
    checkLine('Closing Balance', ref.closingBalance,   ourBalance, tol.balance);
    checkLine('Interest Accrued', ref.interestAccrued,  ourInterest, tol.interest);
    checkLine('Total Fees',       ref.totalFees,        ourFees, tol.fees);
    checkLine('Drawdown',         ref.drawdown,         ourDraw, tol.balance);
    checkLine('Repayment',        ref.repayment,        ourPaydown, tol.balance);
    if(ref.feeBreakdown){
      for(const [k,v] of Object.entries(ref.feeBreakdown)){
        const ours = (ourRow && ourRow.feeBreakdown && ourRow.feeBreakdown[k]) || 0;
        checkLine('Fee · ' + k, v, ours, tol.fees);
      }
    }
    compared.push({
      date: ref.date,
      hasOurRow: !!ourRow,
      lines,
      worstStatus: lines.reduce((acc, l) =>
        l.status === 'break' ? 'break'
        : (l.status === 'within' && acc !== 'break') ? 'within'
        : acc, 'tied'),
      comment: ref.comment || null
    });
    prevDate = ref.date;
  }
  // Summary stats
  const flat = compared.flatMap(p => p.lines);
  const tied   = flat.filter(l => l.status === 'tied').length;
  const within = flat.filter(l => l.status === 'within').length;
  const breaks = flat.filter(l => l.status === 'break').length;
  const totalDiff = flat.reduce((a,l)=> a + l.diff, 0);
  const totalAbsDiff = flat.reduce((a,l)=> a + Math.abs(l.diff), 0);
  return {
    source: referenceData.source || '—',
    exportedAt: referenceData.exportedAt || null,
    tolerances: tol,
    periods: compared,
    summary: {
      periodsCompared: compared.length,
      linesTotal: flat.length,
      linesTied: tied,
      linesWithinTol: within,
      linesBreak: breaks,
      tieRatePct: flat.length ? (tied / flat.length * 100) : 100,
      totalSignedDiff: totalDiff,
      totalAbsDiff
    }
  };
}

/* ---------- Reference data persistence (per-instrument) ---------- */
const LS_KEY_RECON_REF = 'pe-loan-calc.reconciliation-references.v1';
function loadAllReferenceData(){
  try {
    const raw = localStorage.getItem(LS_KEY_RECON_REF);
    if(!raw) return {};
    return JSON.parse(raw) || {};
  } catch(e){ return {}; }
}
function saveAllReferenceData(map){
  try { localStorage.setItem(LS_KEY_RECON_REF, JSON.stringify(map || {})); }
  catch(e){ console.warn('Could not persist reference data:', e); }
}
function getReferenceForInstrument(id){ return loadAllReferenceData()[id] || null; }
function setReferenceForInstrument(id, refData){
  const all = loadAllReferenceData();
  all[id] = refData;
  saveAllReferenceData(all);
}
function clearReferenceForInstrument(id){
  const all = loadAllReferenceData();
  delete all[id];
  saveAllReferenceData(all);
}

/* ---------- DIU generator (N-6 / N-9) ---------- */
/* ---------- Investran GL chart mapping --------------------------------
   Maps the calculator's transaction types to the Investran GL accounts
   from "GL Accounts and tran types.xlsx". Each entry carries:
     account     — Investran 6-digit GL account code
     accountName — Investran display name
     transType   — Investran transaction type (when one cleanly matches)
     gap         — true when no clean match exists (operator must create)
     gapNote     — explanation shown in the GL Coverage panel
*/
const INVESTRAN_GL = {
  // ─── Cash ─────────────────────────────────────────────────────
  cashReceipt:     { account:'111000', accountName:'Cash', transType:'Cash received' },
  cashDisbursed:   { account:'111000', accountName:'Cash', transType:'Cash disbursed' },
  // ─── Loan asset (drawdown / repayment / capitalisation) ───────
  loanDrawdownInitial:    { account:'141000', accountName:'Investments at Cost', transType:'Purchase of investment - Notes - initial drawdown' },
  loanDrawdownAdditional: { account:'141000', accountName:'Investments at Cost', transType:'Purchase of investment - Notes - additional drawdown' },
  loanReturnOfCapital:    { account:'141000', accountName:'Investments at Cost', transType:'Sale of investment - Notes - Return of capital' },
  loanPikCapitalisation:  { account:'141000', accountName:'Investments at Cost', transType:'Purchase of investment - Notes - principal from capitalization' },
  loanOID:                { account:'141000', accountName:'Investments at Cost', transType:'Investment accretion - Original issue discount' },
  loanPIKAccretion:       { account:'141000', accountName:'Investments at Cost', transType:'Investment accretion - PIK interest' },
  // ─── Receivables ──────────────────────────────────────────────
  interestReceivable:  { account:'113000', accountName:'Accounts Receivable', transType:'Interest receivable' },
  interestReceived:    { account:'113000', accountName:'Accounts Receivable', transType:'Interest received' },
  pikReceivable:       { account:'113000', accountName:'Accounts Receivable', transType:'Portfolio PIK interest receivable' },
  // Per-fee-type IFRS 15 fee receivables (NewReport(4) — gap closed). Each fee
  // type now has dedicated DR-side and CR-side (cash settlement) transtypes.
  feeReceivableArrangement:  { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Arrangement' },
  feeReceivedArrangement:    { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Arrangement' },
  feeReceivableCommitment:   { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Commitment' },
  feeReceivedCommitment:     { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Commitment' },
  feeReceivableGuarantee:    { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Guarantee' },
  feeReceivedGuarantee:      { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Guarantee' },
  feeReceivableManagement:   { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Management' },
  feeReceivedManagement:     { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Management' },
  feeReceivableDividend:     { account:'113000', accountName:'Accounts Receivable', transType:'Fee receivable – Dividend (Equity)' },
  feeReceivedDividend:       { account:'113000', accountName:'Accounts Receivable', transType:'Fee received – Dividend (Equity)' },
  // Generic fallback when the fee label doesn't fit any of the IFRS 15 buckets above.
  feeReceivable:       { account:'113000', accountName:'Accounts Receivable', transType:'Other receivable' },
  // Default interest / non-use fee receivable — no dedicated transtype on Investran chart.
  // These still use 'Other receivable' and are the only Priority-3 gap remaining.
  defaultIntReceivable:{ account:'113000', accountName:'Accounts Receivable', transType:'Other receivable',
                         gap:true, gapNote:'Default interest receivable — no specific transtype. The income side ("Default interest income (penalty rate)" under 421000) is mapped, but the DR-side receivable still falls back to "Other receivable". Optional: add "Default interest receivable" / "Default interest received" transtypes under 113000.' },
  defaultFeeReceivable:{ account:'113000', accountName:'Accounts Receivable', transType:'Other receivable',
                         gap:true, gapNote:'Default fee receivable — no specific transtype. The income side ("Default fee income" under 492000) is mapped, but the DR-side receivable still falls back to "Other receivable". Optional: add "Default fee receivable" / "Default fee received" transtypes under 113000.' },
  nonUseFeeReceivable: { account:'113000', accountName:'Accounts Receivable', transType:'Other receivable',
                         gap:true, gapNote:'Non-use fee receivable — no specific transtype. The income side ("Non-use fee income (lender)" under 492000) is mapped, but the DR-side receivable still falls back to "Other receivable". Optional: add "Non-use fee receivable" transtype under 113000.' },
  whtReceivable:       { account:'113000', accountName:'Accounts Receivable', transType:'Withholding tax receivable' },
  // ─── Income — interest ────────────────────────────────────────
  interestIncomeAccrued: { account:'421000', accountName:'Investment Interest Income', transType:'Income - Investment interest - Accrued' },
  interestIncomeCash:    { account:'421000', accountName:'Investment Interest Income', transType:'Income - Investment interest - Cash' },
  interestIncomePIK:     { account:'421000', accountName:'Investment Interest Income', transType:'Income - Investment interest - PIK/Accreted' },
  // ─── Income — IFRS 15 fees (dedicated accounts) ───────────────
  feeIncome:                { account:'492000', accountName:'Other Income - Amendments', transType:'Income - Other - Amendment fees' },  // generic fallback
  arrangementFeeIncome:     { account:'492100', accountName:'Arrangement Fee Income',         transType:'Arrangement fee income – IFRS 15' },
  commitmentFeeIncome:      { account:'492200', accountName:'Commitment Fee Income',          transType:'Commitment fee income – IFRS 15' },
  guaranteeFeeIncome:       { account:'492300', accountName:'Guarantee Fee Income',           transType:'Guarantee fee income – IFRS 15' },
  managementFeeIncomeInv:   { account:'492400', accountName:'Management Fee Income',          transType:'Management fee income – investment period' },
  managementFeeIncomePost:  { account:'492400', accountName:'Management Fee Income',          transType:'Management fee income – post-investment' },
  dividendIncome:           { account:'492500', accountName:'Dividend Income (Equity – IFRS 15)', transType:'Dividend income – IFRS 15' },
  // ─── Default interest / default fees / non-use fee (NewReport(4) — gaps closed)
  defaultIntIncome:      { account:'421000', accountName:'Investment Interest Income', transType:'Default interest income (penalty rate)' },
  defaultFeeIncome:      { account:'492000', accountName:'Other Income - Amendments',  transType:'Default fee income' },
  nonUseFeeIncome:       { account:'492000', accountName:'Other Income - Amendments',  transType:'Non-use fee income (lender)' },
  // ─── Gains / losses ───────────────────────────────────────────
  fxUnrealised:        { account:'450000', accountName:'Unrealized Gain/Loss', transType:'Unrealized gain/(loss) - F/X gain/(loss)' },
  fxRealised:          { account:'440000', accountName:'Realized Gain/Loss',   transType:'Realized gain/(loss) - Short term - F/X' },
  modificationGain:    { account:'442000', accountName:'Modification Gain / Loss (IFRS 9 §5.4.3)', transType:'Modification gain – IFRS 9' },
  modificationLoss:    { account:'442000', accountName:'Modification Gain / Loss (IFRS 9 §5.4.3)', transType:'Modification loss – IFRS 9' },
  // ─── IFRS 9 ECL ───────────────────────────────────────────────
  impairmentExpense:   { account:'470000', accountName:'Impairment / ECL Expense (IFRS 9 §5.5)', transType:'Impairment expense – IFRS 9 ECL' },
  loanLossAllowance:   { account:'145000', accountName:'Loan Loss Allowance – IFRS 9 ECL',       transType:'Loan loss allowance – IFRS 9 ECL' },
  // ─── Hedge accounting (IFRS 9 §6) ─────────────────────────────
  hedgingInstrument:        { account:'146000', accountName:'Derivative Assets / Liabilities', transType:'Hedging instrument MTM' },
  hedgingInstrumentCFHEff:  { account:'146000', accountName:'Derivative Assets / Liabilities', transType:'Hedging instrument MTM – CFH effective' },
  hedgingInstrumentCFHIneff:{ account:'146000', accountName:'Derivative Assets / Liabilities', transType:'Hedging instrument MTM – CFH ineffective' },
  hedgingInstrumentFVH:     { account:'146000', accountName:'Derivative Assets / Liabilities', transType:'Hedging instrument MTM – FV hedge' },
  cfhReserve:               { account:'360000', accountName:'Cash Flow Hedge Reserve (OCI)',   transType:'Cash flow hedge reserve – OCI' },
  cfhReserveReclass:        { account:'360000', accountName:'Cash Flow Hedge Reserve (OCI)',   transType:'Cash flow hedge reserve – reclassification' },
  hedgeIneffectiveness:     { account:'451000', accountName:'Hedge Ineffectiveness P&L',       transType:'Hedge ineffectiveness P&L' },
  fvHedgePL:                { account:'452000', accountName:'Fair Value Hedge P&L',            transType:'Fair value hedge P&L' },
  hedgeReclass:             { account:'421000', accountName:'Investment Interest Income',     transType:'Income - Investment interest' }  // P&L side of CFH reclassification
};

// Map our internal placeholder-account-codes / transaction-type strings onto
// the Investran chart. Called once on each batch of JE entries after the
// generators run so we don't have to thread the mapping through every add().
function applyInvestranGLMapping(entries){
  // Transaction-type keyword → Investran GL key. Order matters: more specific
  // keywords must be checked before more general ones.
  const lookup = (tt, ourAcct) => {
    const t = (tt || '').toLowerCase();
    // Cash-leg lines (drawdown cash, repayment cash, fee/interest cash receipts)
    if(/cash receipt/.test(t) || /drawdown — cash/.test(t)) return INVESTRAN_GL.cashReceipt;
    if(/repayment — cash/.test(t))                          return INVESTRAN_GL.cashDisbursed;
    // Loan asset legs
    if(/^loan drawdown\b/.test(t) || /drawdown.*initial/.test(t))   return INVESTRAN_GL.loanDrawdownInitial;
    if(/^loan repayment\b/.test(t))                                return INVESTRAN_GL.loanReturnOfCapital;
    if(/pik (investment|capitalization)/.test(t))                  return INVESTRAN_GL.loanPikCapitalisation;
    if(/discount accretion|premium amort/.test(t))                 return INVESTRAN_GL.loanOID;
    if(/eir fee accretion/.test(t) && /offset/.test(t))            return INVESTRAN_GL.loanOID;
    if(/eir fee accretion/.test(t))                                return INVESTRAN_GL.interestIncomeAccrued;
    // Default interest / default fee — clear-leg checked BEFORE the bare receivable
    // pattern (the "clear" suffix is more specific and must match first).
    if(/default interest receivable clear/.test(t))                return INVESTRAN_GL.interestReceived;
    if(/default interest receivable/.test(t))                      return INVESTRAN_GL.defaultIntReceivable;
    if(/default interest income/.test(t))                          return INVESTRAN_GL.defaultIntIncome;
    if(/default interest cash receipt/.test(t))                    return INVESTRAN_GL.cashReceipt;
    if(/default fee receivable clear/.test(t))                     return INVESTRAN_GL.defaultFeeReceivable;
    if(/default fee receivable/.test(t))                           return INVESTRAN_GL.defaultFeeReceivable;
    if(/default fee income/.test(t))                               return INVESTRAN_GL.defaultFeeIncome;
    // Non-use fee
    if(/non-use fee receivable clear/.test(t))                     return INVESTRAN_GL.nonUseFeeReceivable;
    if(/non-use fee receivable/.test(t))                           return INVESTRAN_GL.nonUseFeeReceivable;
    if(/non-use fee income/.test(t))                               return INVESTRAN_GL.nonUseFeeIncome;
    // FX revaluation
    if(/fx (revaluation )?(gain|loss)/.test(t))                    return INVESTRAN_GL.fxUnrealised;
    if(/fx revaluation .*loan asset/.test(t))                      return INVESTRAN_GL.loanReturnOfCapital;
    // Modification gain/loss
    if(/modification (gain|loss)/.test(t) && !/offset|adjust/.test(t)) {
      return /gain/.test(t) ? INVESTRAN_GL.modificationGain : INVESTRAN_GL.modificationLoss;
    }
    if(/modification.*loan asset/.test(t))                         return INVESTRAN_GL.loanReturnOfCapital;
    // ECL / Impairment
    if(/impairment expense|impairment reversal/.test(t))           return INVESTRAN_GL.impairmentExpense;
    if(/loan loss allowance/.test(t))                              return INVESTRAN_GL.loanLossAllowance;
    // Hedge accounting — CFH OCI side, reclassification, ineffectiveness, FV hedge
    if(/cash flow hedge reserve.*reclass|hedge reserve reclass/.test(t)) return INVESTRAN_GL.cfhReserveReclass;
    if(/hedge income.*reclass/.test(t))                            return INVESTRAN_GL.hedgeReclass;
    if(/cfh oci|cash flow hedge reserve/.test(t))                  return INVESTRAN_GL.cfhReserve;
    if(/hedging instrument.*cfh oci/.test(t))                      return INVESTRAN_GL.hedgingInstrumentCFHEff;
    if(/hedging instrument mtm \(cfh/.test(t))                     return INVESTRAN_GL.hedgingInstrumentCFHEff;
    if(/hedging instrument/.test(t) && /fv|fair value/.test(t))    return INVESTRAN_GL.hedgingInstrumentFVH;
    if(/hedging instrument/.test(t))                               return INVESTRAN_GL.hedgingInstrumentCFHIneff;
    if(/hedge ineffectiveness/.test(t))                            return INVESTRAN_GL.hedgeIneffectiveness;
    if(/fair value hedge p&l/.test(t))                             return INVESTRAN_GL.fvHedgePL;
    // Interest legs
    if(/interest receivable clear/.test(t))                        return INVESTRAN_GL.interestReceived;
    if(/interest receivable/.test(t))                              return INVESTRAN_GL.interestReceivable;
    if(/income.*daily accrued interest/.test(t))                   return INVESTRAN_GL.interestIncomeAccrued;
    if(/interest cash receipt/.test(t))                            return INVESTRAN_GL.cashReceipt;
    // IFRS 15 fee legs — per-fee-type routing into dedicated accounts.
    // The fee label is what JE rows are tagged with (e.g. "Arrangement Fee Receivable",
    // "Arrangement Fee Receivable Clear", "Arrangement Fee Income"). Route both the
    // receivable / clear / income variants per fee type before falling back to generic.
    // Arrangement
    if(/arrangement fee receivable clear/.test(t))                 return INVESTRAN_GL.feeReceivedArrangement;
    if(/arrangement fee receivable/.test(t))                       return INVESTRAN_GL.feeReceivableArrangement;
    if(/arrangement fee.*income|arrangement fee \(/.test(t))       return INVESTRAN_GL.arrangementFeeIncome;
    // Commitment (NWF or generic)
    if(/(commitment fee|nwf commitment fee) receivable clear/.test(t)) return INVESTRAN_GL.feeReceivedCommitment;
    if(/(commitment fee|nwf commitment fee) receivable/.test(t))   return INVESTRAN_GL.feeReceivableCommitment;
    if(/(commitment fee|nwf commitment fee).*income|(commitment fee|nwf commitment fee) \(/.test(t))
                                                                    return INVESTRAN_GL.commitmentFeeIncome;
    // Guarantee
    if(/guarantee fee receivable clear/.test(t))                   return INVESTRAN_GL.feeReceivedGuarantee;
    if(/guarantee fee receivable/.test(t))                         return INVESTRAN_GL.feeReceivableGuarantee;
    if(/guarantee fee.*income|guarantee fee \(/.test(t))           return INVESTRAN_GL.guaranteeFeeIncome;
    // Management
    if(/management fee.*receivable clear/.test(t))                 return INVESTRAN_GL.feeReceivedManagement;
    if(/management fee.*receivable/.test(t))                       return INVESTRAN_GL.feeReceivableManagement;
    if(/management fee \(investment period\).*income/.test(t))     return INVESTRAN_GL.managementFeeIncomeInv;
    if(/management fee \(post-investment\).*income/.test(t))       return INVESTRAN_GL.managementFeeIncomePost;
    // Dividend (Equity, IFRS 15)
    if(/dividend.*receivable clear/.test(t))                       return INVESTRAN_GL.feeReceivedDividend;
    if(/dividend.*receivable/.test(t))                             return INVESTRAN_GL.feeReceivableDividend;
    if(/dividend income.*income \(ifrs 15\)|dividend.*\(ifrs 15\)/.test(t)) return INVESTRAN_GL.dividendIncome;
    // Generic IFRS 15 fee / PortF fallback
    if(/income \(ifrs 15\)|fee income \(ifrs 15\)|income \(portf\)/.test(t)) return INVESTRAN_GL.feeIncome;
    if(/cash receipt/.test(t))                                     return INVESTRAN_GL.cashReceipt;
    if(/receivable clear/.test(t))                                 return INVESTRAN_GL.feeReceivable;
    if(/receivable/.test(t))                                       return INVESTRAN_GL.feeReceivable;
    if(/fee income/.test(t))                                       return INVESTRAN_GL.feeIncome;
    return null;
  };
  for(const e of entries){
    const map = lookup(e.transactionType, e.account);
    if(map){
      e.account = map.account;
      e.glAccountName = map.accountName;
      e.glTransType = map.transType || e.transactionType;
      e.glGap = !!map.gap;
      e.glGapNote = map.gapNote || null;
    } else {
      // No mapping found — flag as a gap so the GL Coverage panel surfaces it
      e.glAccountName = '— UNMAPPED —';
      e.glGap = true;
      e.glGapNote = `No mapping rule for "${e.transactionType}". Add to INVESTRAN_GL or extend the lookup() rules.`;
    }
  }
  return entries;
}

function generateDIU(instr, summary){
  if(!summary || !summary.rows.length) return [];
  const ctx = { legal: instr.legalEntity, leid: instr.leid, deal: instr.deal, position: instr.position, sec: instr.incomeSecurity };
  const entries = [];
  let jeIndex = 1;
  const add = (transType, amount, isDebit, account, effDate, comments) => {
    entries.push({
      legalEntity: ctx.legal, leid: ctx.leid, batchId: 1, jeIndex: jeIndex, txIndex: isDebit?2:1,
      glDate: summary.periodEnd, effectiveDate: effDate,
      deal: ctx.deal, position: ctx.position, incomeSecurity: ctx.sec,
      transactionType: transType, account: account, allocationRule: isDebit?'Non-Dominant':'By Commitment and GL Date',
      batchType: 'Loan Calculator',
      batchComments: `Loan Calculator Entries from ${summary.periodStart} to ${summary.periodEnd}`,
      transactionComments: comments,
      originalAmount: isDebit ? amount : amount,
      amountLE: Math.abs(amount),
      fx: 1, amountLocal: Math.abs(amount),
      isDebit, leDomain: 'Investran Global'
    });
  };
  // Interest pair
  if(summary.totalCashAccrual){
    add('Interest Receivable',           summary.totalCashAccrual, false, '40100', summary.periodEnd, `Interest Adjustment for ${summary.periodEnd}`);
    add('Income - Daily Accrued Interest', summary.totalCashAccrual, true,  '23000', summary.periodEnd, `Interest Adjustment for ${summary.periodEnd}`);
    jeIndex++;
  }
  // PIK pair (capitalization)
  if(summary.totalCapitalized){
    add('PIK Investment', -summary.totalCapitalized, true,  '40100', summary.periodEnd, `PIK Capitalization for ${summary.periodEnd}`);
    add('Interest Receivable', -summary.totalCapitalized, false, '23000', summary.periodEnd, `PIK Capitalization for ${summary.periodEnd}`);
    jeIndex++;
  }
  // Amortization
  if(Math.abs(summary.totalAmort) > 0.005){
    const label = summary.totalAmort > 0 ? 'Discount Accretion' : 'Premium Amortization';
    add(label, summary.totalAmort, false, '40150', summary.periodEnd, `${label} for ${summary.periodEnd}`);
    add(label + ' Offset', summary.totalAmort, true, '23000', summary.periodEnd, `${label} for ${summary.periodEnd}`);
    jeIndex++;
  }
  // Non-use fee
  if(summary.totalNonUseFee > 0.005){
    add('Non-Use Fee Income', summary.totalNonUseFee, false, '40200', summary.periodEnd, `Non-use fee for ${summary.periodEnd}`);
    add('Non-Use Fee Receivable', summary.totalNonUseFee, true, '23100', summary.periodEnd, `Non-use fee for ${summary.periodEnd}`);
    jeIndex++;
  }
  // Hedge accounting (IFRS 9 §6) — three components per period:
  //  1) CFH effective portion → DR/CR Hedging Instrument (16000) / Cash Flow Hedge Reserve OCI (35000)
  //  2) Ineffective (CFH) or full MTM (FVH) → DR/CR Hedging Instrument / P&L Hedge Ineffectiveness (45100) / FV Hedge P&L (45200)
  //  3) Reclassification on settlement → DR Cash Flow Hedge Reserve / CR Hedge Income (45100)
  if(Math.abs(summary.totalHedgeOCI || 0) > 0.005){
    const v = summary.totalHedgeOCI;
    if(v > 0){
      add('Hedging Instrument MTM (CFH OCI)',  v, true,  '16000', summary.periodEnd, `CFH effective portion to OCI for ${summary.periodEnd}`);
      add('Cash Flow Hedge Reserve (OCI)',     v, false, '35000', summary.periodEnd, `CFH effective portion to OCI for ${summary.periodEnd}`);
    } else {
      add('Hedging Instrument MTM (CFH OCI)', -v, false, '16000', summary.periodEnd, `CFH effective portion to OCI for ${summary.periodEnd}`);
      add('Cash Flow Hedge Reserve (OCI)',    -v, true,  '35000', summary.periodEnd, `CFH effective portion to OCI for ${summary.periodEnd}`);
    }
    jeIndex++;
  }
  if(Math.abs(summary.totalHedgePL || 0) > 0.005){
    const v = summary.totalHedgePL;
    const acct = (instr.hedge?.type === 'FVH') ? '45200' : '45100';
    const label = (instr.hedge?.type === 'FVH') ? 'Fair Value Hedge P&L' : 'Hedge Ineffectiveness P&L';
    if(v > 0){
      add('Hedging Instrument MTM',  v, true,  '16000', summary.periodEnd, `Hedge MTM to P&L for ${summary.periodEnd}`);
      add(label,                     v, false, acct,    summary.periodEnd, `Hedge MTM to P&L for ${summary.periodEnd}`);
    } else {
      add('Hedging Instrument MTM', -v, false, '16000', summary.periodEnd, `Hedge MTM to P&L for ${summary.periodEnd}`);
      add(label,                    -v, true,  acct,    summary.periodEnd, `Hedge MTM to P&L for ${summary.periodEnd}`);
    }
    jeIndex++;
  }
  if(Math.abs(summary.totalHedgeReclass || 0) > 0.005){
    const v = summary.totalHedgeReclass;
    if(v > 0){
      add('Cash Flow Hedge Reserve Reclass',  v, true,  '35000', summary.periodEnd, `CFH reclass to P&L on settlement ${summary.periodEnd}`);
      add('Hedge Income (Reclass from OCI)',  v, false, '45100', summary.periodEnd, `CFH reclass to P&L on settlement ${summary.periodEnd}`);
    } else {
      add('Cash Flow Hedge Reserve Reclass', -v, false, '35000', summary.periodEnd, `CFH reclass to P&L on settlement ${summary.periodEnd}`);
      add('Hedge Income (Reclass from OCI)', -v, true,  '45100', summary.periodEnd, `CFH reclass to P&L on settlement ${summary.periodEnd}`);
    }
    jeIndex++;
  }
  // Modification gain/loss (IFRS 9 §5.4.3) — DR/CR P&L Modification Gain/Loss / Loan Asset
  if(Math.abs(summary.totalModGain || 0) > 0.005){
    const v = summary.totalModGain;
    if(v > 0){
      add('Modification Gain (IFRS 9)',                  v, false, '44000', summary.periodEnd, `Modification gain for ${summary.periodEnd}`);
      add('Modification — Loan Asset Adjustment',         v, true,  '15000', summary.periodEnd, `Modification gain for ${summary.periodEnd}`);
    } else {
      add('Modification Loss (IFRS 9)',                 -v, true,  '44000', summary.periodEnd, `Modification loss for ${summary.periodEnd}`);
      add('Modification — Loan Asset Adjustment',       -v, false, '15000', summary.periodEnd, `Modification loss for ${summary.periodEnd}`);
    }
    jeIndex++;
  }
  // ECL provisioning (IFRS 9 §5.5) — DR Impairment expense / CR Loan Loss Allowance
  // Net change can be positive (build-up) or negative (release on stage migration / paydown)
  if(Math.abs(summary.totalECLChange || 0) > 0.005){
    const v = summary.totalECLChange;
    if(v > 0){
      add('Impairment Expense (ECL)',           v, true,  '70100', summary.periodEnd, `IFRS 9 ECL provision for ${summary.periodEnd}`);
      add('Loan Loss Allowance (Contra-Asset)', v, false, '15500', summary.periodEnd, `IFRS 9 ECL provision for ${summary.periodEnd}`);
    } else {
      add('Impairment Reversal (ECL)',          -v, false, '70100', summary.periodEnd, `IFRS 9 ECL release for ${summary.periodEnd}`);
      add('Loan Loss Allowance Reversal',       -v, true,  '15500', summary.periodEnd, `IFRS 9 ECL release for ${summary.periodEnd}`);
    }
    jeIndex++;
  }
  // FX revaluation gain/loss — DR/CR Forex P&L (45000) / Loan Asset (15000)
  if(Math.abs(summary.totalFXGain || 0) > 0.005){
    const v = summary.totalFXGain;
    if(v > 0){
      add('FX Revaluation Gain', v, false, '45000', summary.periodEnd, `FX reval (functional currency) for ${summary.periodEnd}`);
      add('FX Revaluation — Loan Asset Adjustment', v, true,  '15000', summary.periodEnd, `FX reval (functional currency) for ${summary.periodEnd}`);
    } else {
      add('FX Revaluation Loss', -v, true,  '45000', summary.periodEnd, `FX reval (functional currency) for ${summary.periodEnd}`);
      add('FX Revaluation — Loan Asset Adjustment', -v, false, '15000', summary.periodEnd, `FX reval (functional currency) for ${summary.periodEnd}`);
    }
    jeIndex++;
  }
  // Default interest (penalty rate × outstanding balance from event date)
  if((summary.totalDefaultInterest || 0) > 0.005){
    add('Default Interest Income',     summary.totalDefaultInterest, false, '40130', summary.periodEnd, `Default interest for ${summary.periodEnd}`);
    add('Default Interest Receivable', summary.totalDefaultInterest, true,  '23130', summary.periodEnd, `Default interest for ${summary.periodEnd}`);
    jeIndex++;
  }
  // Default fee (one-off penalty fee on event date)
  if((summary.totalDefaultFee || 0) > 0.005){
    add('Default Fee Income',     summary.totalDefaultFee, false, '40140', summary.periodEnd, `Default fee for ${summary.periodEnd}`);
    add('Default Fee Receivable', summary.totalDefaultFee, true,  '23140', summary.periodEnd, `Default fee for ${summary.periodEnd}`);
    jeIndex++;
  }
  // EIR accretion of deferred IFRS-9 fees (arrangement / OID-style)
  // DR Loan carrying value (40110) / CR Interest income (40100)
  if(Math.abs(summary.totalEIRAccretion || 0) > 0.005){
    const v = summary.totalEIRAccretion;
    add('EIR Fee Accretion (IFRS 9)',          v, false, '40100', summary.periodEnd, `IFRS 9 EIR fee accretion for ${summary.periodEnd}`);
    add('EIR Fee Accretion Offset (IFRS 9)',   v, true,  '40110', summary.periodEnd, `IFRS 9 EIR fee accretion for ${summary.periodEnd}`);
    jeIndex++;
  }
  // IFRS 15 fees — by label, posted to fee-income / fee-receivable pair.
  // GL split: 40250 Fee Income (commitment / arrangement / guarantee), 23150 Fee Receivable.
  const fb = summary.feeBreakdown || {};
  for(const [label, amt] of Object.entries(fb)){
    if(Math.abs(amt) <= 0.005) continue;
    add(`${label} Income (IFRS 15)`,     amt, false, '40250', summary.periodEnd, `${label} accrual for ${summary.periodEnd}`);
    add(`${label} Receivable`,           amt, true,  '23150', summary.periodEnd, `${label} accrual for ${summary.periodEnd}`);
    jeIndex++;
  }
  // ----- CASH-LEG JEs (closes the half-double-entry gap) -------------------
  // Drawdowns: DR Loan Asset (15000) / CR Cash (10000) — one pair per draw event
  // Repayments: DR Cash (10000) / CR Loan Asset (15000) — one pair per repayment
  // Cash settlement of accrued income at period end: DR Cash / CR Receivable
  // (clears the corresponding 23000/23130/23140/23150 receivables booked above).
  for(const r of summary.rows){
    if(r.draw && r.draw > 0.005){
      add('Loan Drawdown',          r.draw, true,  '15000', r.date, `Drawdown ${r.date}`);
      add('Loan Drawdown — Cash',   r.draw, false, '10000', r.date, `Drawdown ${r.date}`);
      jeIndex++;
    }
    if(r.paydown && r.paydown > 0.005){
      add('Loan Repayment — Cash',   r.paydown, true,  '10000', r.date, `Repayment ${r.date}`);
      add('Loan Repayment',          r.paydown, false, '15000', r.date, `Repayment ${r.date}`);
      jeIndex++;
    }
  }
  // Cash settlement at period end: assume accrued interest + fees paid on
  // periodEnd date (a simplification — real systems track per-fee payment
  // schedules). Pair up to clear the receivables we booked above.
  if(summary.totalCashAccrual > 0.005){
    add('Interest Cash Receipt',     summary.totalCashAccrual, true,  '10000', summary.periodEnd, `Interest cash settlement ${summary.periodEnd}`);
    add('Interest Receivable Clear', summary.totalCashAccrual, false, '23000', summary.periodEnd, `Interest cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  for(const [label, amt] of Object.entries(fb)){
    if(Math.abs(amt) <= 0.005) continue;
    add(`${label} Cash Receipt`,            amt, true,  '10000', summary.periodEnd, `${label} cash settlement ${summary.periodEnd}`);
    add(`${label} Receivable Clear`,        amt, false, '23150', summary.periodEnd, `${label} cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  if((summary.totalDefaultInterest || 0) > 0.005){
    add('Default Interest Cash Receipt',     summary.totalDefaultInterest, true,  '10000', summary.periodEnd, `Default interest cash settlement ${summary.periodEnd}`);
    add('Default Interest Receivable Clear', summary.totalDefaultInterest, false, '23130', summary.periodEnd, `Default interest cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  if((summary.totalDefaultFee || 0) > 0.005){
    add('Default Fee Cash Receipt',          summary.totalDefaultFee, true,  '10000', summary.periodEnd, `Default fee cash settlement ${summary.periodEnd}`);
    add('Default Fee Receivable Clear',      summary.totalDefaultFee, false, '23140', summary.periodEnd, `Default fee cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  if(summary.totalNonUseFee > 0.005){
    add('Non-Use Fee Cash Receipt',          summary.totalNonUseFee, true,  '10000', summary.periodEnd, `Non-use fee cash settlement ${summary.periodEnd}`);
    add('Non-Use Fee Receivable Clear',      summary.totalNonUseFee, false, '23100', summary.periodEnd, `Non-use fee cash settlement ${summary.periodEnd}`);
    jeIndex++;
  }
  return applyInvestranGLMapping(entries);
}

/* ---------- DIU generator — from PortF Data ---------------
   Walks the loaded reference's scheduleResults[] (date-indexed period rows)
   and emits the same DIU JE pair shape that generateDIU() produces from
   our calculator. Used when the DIU Export tab's Source = "PortF Data".
*/
function generateDIUFromReference(instr, referenceData){
  if(!instr || !referenceData || !Array.isArray(referenceData.scheduleResults)) return [];
  const ctx = { legal: instr.legalEntity, leid: instr.leid, deal: instr.deal, position: instr.position, sec: instr.incomeSecurity };
  const entries = [];
  let jeIndex = 1;
  const add = (transType, amount, isDebit, account, effDate, comments) => {
    entries.push({
      legalEntity: ctx.legal, leid: ctx.leid, batchId: 1, jeIndex: jeIndex, txIndex: isDebit?2:1,
      glDate: effDate, effectiveDate: effDate,
      deal: ctx.deal, position: ctx.position, incomeSecurity: ctx.sec,
      transactionType: transType, account: account, allocationRule: isDebit?'Non-Dominant':'By Commitment and GL Date',
      batchType: 'Loan Calculator (PortF)',
      batchComments: `From reference: ${referenceData.source || 'unknown'} · ${effDate}`,
      transactionComments: comments,
      originalAmount: isDebit ? amount : amount,
      amountLE: Math.abs(amount), fx: 1, amountLocal: Math.abs(amount),
      isDebit, leDomain: 'Investran Global · PortF'
    });
  };
  for(const ref of referenceData.scheduleResults){
    const eff = ref.date;
    // Interest accrual pair (+ cash-settlement clear)
    if((ref.interestAccrued || 0) > 0.005){
      add('Interest Receivable',           ref.interestAccrued, false, '40100', eff, `Interest accrual (PortF) ${eff}`);
      add('Income - Daily Accrued Interest', ref.interestAccrued, true,  '23000', eff, `Interest accrual (PortF) ${eff}`);
      jeIndex++;
      add('Interest Cash Receipt',     ref.interestAccrued, true,  '10000', eff, `Interest cash settlement (PortF) ${eff}`);
      add('Interest Receivable Clear', ref.interestAccrued, false, '23000', eff, `Interest cash settlement (PortF) ${eff}`);
      jeIndex++;
    }
    // Fees — by breakdown if provided, else as a single line
    if(ref.feeBreakdown && Object.keys(ref.feeBreakdown).length){
      for(const [label, amt] of Object.entries(ref.feeBreakdown)){
        if(Math.abs(amt) <= 0.005) continue;
        add(`${label} Income (PortF)`,        amt, false, '40250', eff, `${label} accrual (PortF) ${eff}`);
        add(`${label} Receivable`,                amt, true,  '23150', eff, `${label} accrual (PortF) ${eff}`);
        jeIndex++;
        add(`${label} Cash Receipt`,              amt, true,  '10000', eff, `${label} cash settlement (PortF) ${eff}`);
        add(`${label} Receivable Clear`,          amt, false, '23150', eff, `${label} cash settlement (PortF) ${eff}`);
        jeIndex++;
      }
    } else if((ref.totalFees || 0) > 0.005){
      add('Fee Income (PortF)',     ref.totalFees, false, '40250', eff, `Total fees (PortF) ${eff}`);
      add('Fee Receivable',             ref.totalFees, true,  '23150', eff, `Total fees (PortF) ${eff}`);
      jeIndex++;
      add('Fee Cash Receipt',           ref.totalFees, true,  '10000', eff, `Fee cash settlement (PortF) ${eff}`);
      add('Fee Receivable Clear',       ref.totalFees, false, '23150', eff, `Fee cash settlement (PortF) ${eff}`);
      jeIndex++;
    }
    // Drawdown pair
    if((ref.drawdown || 0) > 0.005){
      add('Loan Drawdown',          ref.drawdown, true,  '15000', eff, `Drawdown (PortF) ${eff}`);
      add('Loan Drawdown — Cash',   ref.drawdown, false, '10000', eff, `Drawdown (PortF) ${eff}`);
      jeIndex++;
    }
    // Repayment pair
    if((ref.repayment || 0) > 0.005){
      add('Loan Repayment — Cash',   ref.repayment, true,  '10000', eff, `Repayment (PortF) ${eff}`);
      add('Loan Repayment',          ref.repayment, false, '15000', eff, `Repayment (PortF) ${eff}`);
      jeIndex++;
    }
  }
  return applyInvestranGLMapping(entries);
}




/* Loan Module Integration Layer — Instrument dataset
   Mirrors INSTRUMENTS in income-calculator.html
   Last sync: 2026-05-08 */
const INSTRUMENTS = [
  {
    id:'alliance',
    positionId:'POS-FCP1-ALLIANCE-CN', securityId:'SEC-ALLIANCE-2019-CN',
    legalEntity:'FIS Capital Partners I', leid: 7,
    deal:'Alliance Manufacturing',
    position:'FCP-I 100% holding · Alliance CN',
    incomeSecurity:'Alliance Manufacturing Convertible Note (12% / 14% PIK)',
    faceValue: 25000000,
    purchasePrice: 25000000, // at par
    commitment: 25000000,
    settlementDate: '2019-01-15',
    maturityDate:   '2020-03-05',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/360',
    coupon: { type:'Fixed', fixedRate: 0.12, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:true, rate: 0.14, capitalizationFrequency: 'Monthly' },
    principalRepayment: 'AtMaturity',
    principalSchedule: [
      { date:'2019-01-15', type:'initial', amount: 25000000 }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    type:'pikNoteFixed',
    preset:'Alliance Manufacturing · Interest + PIK @ par'
  },
  {
    id:'discountBond',
    positionId:'POS-FCP1-COPPERLEAF', securityId:'SEC-COPPERLEAF-2030-SRNOTE',
    legalEntity:'FIS Capital Partners I', leid: 7,
    deal:'Copperleaf Capital',
    position:'FCP-I 100% holding · Copperleaf bond',
    incomeSecurity:'Copperleaf 8% Senior Notes 2030 (Discount Bond)',
    faceValue: 10000000,
    purchasePrice: 9_250_000,      // bought at discount
    commitment: 10_000_000,
    settlementDate: '2024-06-01',
    maturityDate:   '2030-06-01',
    dayBasis: '30/360',
    coupon: { type:'Fixed', fixedRate: 0.08, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate: 0, capitalizationFrequency: 'Monthly' },
    principalRepayment: 'AtMaturity',
    principalSchedule: [
      { date:'2024-06-01', type:'initial', amount: 10_000_000 }
    ],
    amortization: { method:'effectiveInterestPrice' },  // solve EIR from price
    nonUseFee: { enabled:false, rate:0 },
    type:'discountAmort',
    preset:'Copperleaf 8% · Discount Bond (Effective Interest)'
  },
  {
    id:'floatingLoan',
    positionId:'POS-FCP2-ORION-TLB', securityId:'SEC-ORION-TLB-2024',
    legalEntity:'FIS Capital Partners II', leid: 11,
    deal:'Orion Industrial',
    position:'FCP-II £40m Position · Orion TL-B',
    incomeSecurity:'Orion Industrial Term Loan B (SOFR + 575 bps)',
    faceValue: 40_000_000,
    purchasePrice: 40_000_000,
    commitment: 40_000_000,
    settlementDate: '2024-09-15',
    maturityDate:   '2031-09-15',
    dayBasis: 'ACT/360',
    coupon: { type:'Floating', fixedRate: 0, floatingRate: 0.051, spread: 0.0575, floor: 0.08, cap: 0.14 },
    pik: { enabled:false, rate:0 },
    principalRepayment: 'Scheduled',
    principalSchedule: [
      { date:'2024-09-15', type:'initial', amount: 40_000_000 },
      { date:'2025-03-31', type:'paydown', amount:  1_000_000 },
      { date:'2025-09-30', type:'paydown', amount:  1_000_000 },
      { date:'2026-03-31', type:'paydown', amount:  1_000_000 },
    ],
    amortization: { method:'straightLine' },
    nonUseFee: { enabled:false, rate:0 },
    type:'floatingCapsFloors',
    preset:'Orion TL-B · Floating + Caps/Floors'
  },
  {
    // ----------------------------------------------------------------
    // Same Orion TL-B security as above, held by FCP-I in a separate
    // £20m secondary purchase. Demonstrates that ONE security can have
    // MULTIPLE positions across different LEs (the canonical fund-admin
    // multi-LE syndicate model). Both positions share securityId
    // 'SEC-ORION-TLB-2024' but have distinct positionIds, ownership %,
    // settlement dates, and cost bases.
    // ----------------------------------------------------------------
    id:'floatingLoanFCP1',
    positionId:'POS-FCP1-ORION-TLB',  securityId:'SEC-ORION-TLB-2024',  // ← same security as floatingLoan
    legalEntity:'FIS Capital Partners I', leid: 7,
    deal:'Orion Industrial',
    position:'FCP-I £20m Position · Orion TL-B (Secondary)',
    incomeSecurity:'Orion Industrial Term Loan B (SOFR + 575 bps)',
    faceValue: 20_000_000,
    purchasePrice: 19_700_000,            // bought at 98.5 (secondary)
    commitment: 20_000_000,
    settlementDate: '2025-03-15',         // FCP-I bought in 6m after FCP-II's primary
    maturityDate:   '2031-09-15',
    dayBasis: 'ACT/360',
    coupon: { type:'Floating', fixedRate: 0, floatingRate: 0.051, spread: 0.0575, floor: 0.08, cap: 0.14 },
    pik: { enabled:false, rate:0 },
    principalRepayment: 'Scheduled',
    principalSchedule: [
      { date:'2025-03-15', type:'initial', amount: 20_000_000 },
      { date:'2025-09-30', type:'paydown', amount:    500_000 },  // pro-rata
      { date:'2026-03-31', type:'paydown', amount:    500_000 }
    ],
    amortization: { method:'effectiveInterestPrice' },  // accrete the discount over life
    nonUseFee: { enabled:false, rate:0 },
    type:'floatingCapsFloors',
    preset:'Orion TL-B (FCP-I £20m Secondary @ 98.5)'
  },
  {
    id:'revolver',
    positionId:'POS-FCO3-NORTHWIND-RCF', securityId:'SEC-NORTHWIND-RCF-2025',
    legalEntity:'FIS Credit Opps III', leid: 22,
    deal:'Northwind Ventures',
    position:'FCO-III 100% holding · Northwind RCF',
    incomeSecurity:'Northwind Revolving Credit Facility (£50m commitment)',
    faceValue: 15_000_000, // drawn at settle
    purchasePrice: 15_000_000,
    commitment: 50_000_000,
    settlementDate: '2025-01-15',
    maturityDate:   '2029-01-15',
    dayBasis: 'ACT/365',
    coupon: { type:'Fixed', fixedRate: 0.095 },
    pik: { enabled:false, rate:0 },
    principalRepayment: 'Scheduled',
    principalSchedule: [
      { date:'2025-01-15', type:'initial', amount: 15_000_000 },
      { date:'2025-05-01', type:'draw',    amount: 10_000_000 },
      { date:'2025-09-01', type:'paydown', amount:  5_000_000 },
      { date:'2026-03-01', type:'draw',    amount:  7_500_000 },
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:true, rate: 0.005 }, // 50 bps on undrawn
    type:'nonUseFeeFacility',
    preset:'Northwind RCF · Revolver + Non-use Fee'
  },
  {
    // Direct lending / private credit unitranche term loan — the bread-and-butter
    // middle-market financing: 1L unitranche, floating SOFR + 600 with a 1% floor,
    // 1% OID at issue, optional 2% PIK toggle (quarterly cap), 1%/yr amortization,
    // bullet at maturity. Mirrors what a BDC or direct-lending fund would book.
    id:'privateCredit',
    positionId:'POS-DL4-MERIDIAN', securityId:'SEC-MERIDIAN-UNITRANCHE-2025',
    legalEntity:'FIS Direct Lending Fund IV', leid: 31,
    deal:'Meridian Healthcare Services',
    position:'DL-IV 100% holding · Meridian Unitranche',
    incomeSecurity:'Meridian Unitranche Term Loan (SOFR + 600, 1% OID, 2% PIK)',
    faceValue: 35_000_000,
    purchasePrice: 34_650_000, // 99.0 — 100 bps OID
    commitment: 35_000_000,
    settlementDate: '2025-03-15',
    maturityDate:   '2031-03-15',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/360',
    coupon: {
      type:'Floating',
      fixedRate: 0,
      floatingRate: 0.0520,   // SOFR base
      spread: 0.0600,         // 600 bps
      floor: 0.0100,          // 1% SOFR floor
      cap: null
    },
    pik: { enabled:true, rate: 0.0200, capitalizationFrequency: 'Quarterly' },
    principalRepayment: 'Scheduled',
    principalSchedule: [
      { date:'2025-03-15', type:'initial',  amount: 35_000_000 },
      { date:'2026-03-15', type:'paydown',  amount:    350_000 }, // 1%/yr mandatory amort
      { date:'2027-03-15', type:'paydown',  amount:    350_000 },
      { date:'2028-03-15', type:'paydown',  amount:    350_000 },
      { date:'2029-03-15', type:'paydown',  amount:    350_000 },
      { date:'2030-03-15', type:'paydown',  amount:    350_000 },
      // Bullet of remaining principal at maturity
    ],
    amortization: { method:'effectiveInterestPrice' }, // accrete OID over life
    nonUseFee: { enabled:false, rate:0 },
    type:'pikNoteVar',
    preset:'Meridian Unitranche · Private Credit (SOFR + 600, 1% OID, 2% PIK)'
  },
  {
    // ----------------------------------------------------------------
    // Libra 2 / SP023 — UK GBP infrastructure facility, IFRS 9/15 worked example
    // Source: NEW INCOME Calculation requirements.xlsx · Debt Example sheet.
    //
    // £25M HSBC Facility B4 (100%), Compounded SONIA + ratcheted Margin
    // signed 8 Oct 2024, term 10 Oct 2031, ACT/365, modified following.
    // - Arrangement fee 1.75% paid 13/10/2024 (IFRS 9 - capitalised into EIR)
    // - Commitment fee 0.35% on undrawn, paid quarterly (IFRS 15 - over time)
    // - ESG margin adjustment of -2.5 bps from 22 May 2025 onwards
    // - Margin ratchet schedule (bps): 400 → 425 → 450 → 450 → 475 → 500 → 525
    // - Two drawdowns: £15M actual on 17/2/2026 and £10M forecast on 30/6/2026
    // ----------------------------------------------------------------
    id:'libra2',
    positionId:'POS-NWF-LIBRA2-100', securityId:'SEC-LIBRA2-HSBC-FACB4',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Libra 2',
    position:'NWF 100% Bilateral Position · Libra 2',
    incomeSecurity:'HSBC Facility B4 — Libra 2 (Compounded SONIA + Ratcheted Margin)',
    counterpartyId:'SP023',
    transactionId:'SP023',
    bilateralFlag:'Bilateral',
    agentName:'HSBC Bank',
    currency:'GBP',
    faceValue: 25_000_000,
    purchasePrice: 25_000_000,
    commitment: 25_000_000,
    settlementDate: '2024-10-08',           // signing date
    availabilityEnd: '2029-10-10',
    maturityDate:   '2031-10-10',           // termination date
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/365',
    businessDayConvention: 'modifiedFollowing',
    holidayCalendar: 'ukBank',
    skipHolidays: false,
    coupon: {
      type:'SONIA',                          // Compounded RFR + Margin
      fixedRate: 0,
      floatingRate: 0,                       // resolved from rfr.baseRate at runtime
      spread: 0,                             // margin comes from marginSchedule
      floor: null, cap: null
    },
    rfr: {
      index: 'SONIA',
      baseRate: 0.0475,                      // illustrative SONIA fix (4.75%) — replace with feed
      lookbackDays: 5,                       // 5 RFR Banking Days
      rounding: 5                            // 5 decimal places
    },
    marginSchedule: [
      { from:'2024-10-08', to:'2025-03-17', marginBps: 400 },
      { from:'2025-03-18', to:'2025-05-21', marginBps: 425 },
      { from:'2025-05-22', to:'2026-03-17', marginBps: 450 },
      { from:'2026-03-18', to:'2027-03-17', marginBps: 450 },
      { from:'2027-03-18', to:'2028-03-17', marginBps: 475 },
      { from:'2028-03-18', to:'2029-03-17', marginBps: 500 },
      { from:'2029-03-18', to:'2030-03-21', marginBps: 525 },
      { from:'2030-03-22', to:'2031-10-10', marginBps: 525 }
    ],
    esgAdjustment: { from:'2025-05-22', deltaBps: -2.5 },   // ESG margin reduction
    pik: { enabled:false, rate:0, capitalizationFrequency:'Monthly' },
    principalRepayment: 'AtMaturity',          // bullet
    principalSchedule: [
      // Drawdowns per the contractual schedule from
      // NEW INCOME Calculation requirements.xlsx · Debt Example sheet:
      //   - SP023_4: £15M actual drawdown on 17 Feb 2026
      //   - SP023_1: £10M forecasted drawdown on 30 Jun 2026
      // Each carries its own status flag (actual vs forecast) for downstream
      // forecast-vs-contractual reporting (scenario #33).
      { date:'2026-02-17', type:'draw', amount: 15_000_000, drawdownId:'SP023_4', status:'actual'   },
      { date:'2026-06-30', type:'draw', amount: 10_000_000, drawdownId:'SP023_1', status:'forecast' }
    ],
    // Drawn at par (PP = face). The deferred arrangement fee is recognised
    // via the IFRS 9 EIR accretion mechanism (separate from amortization),
    // so no discount/premium amortization is needed here.
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    // ---- Multiple fees — IFRS 9 / IFRS 15 aware ----------------------
    fees: [
      {
        id:'arrangement',
        kind:'arrangement',
        label:'Arrangement Fee',
        mode:'percent',                       // 1.75% × commitment = £437,500
        rate: 0.0175,
        base:'commitment',
        frequency:'oneOff',
        paymentDate:'2024-10-13',
        // Reference SP023 software recognises this on payment date (point-in-time)
        // rather than capitalising into EIR. Switch to IFRS15-pointInTime to tie.
        ifrs:'IFRS15-pointInTime',
        notes:'1.75% × £25M commitment = £437,500 paid 13/10/2024. Recognised on payment date (IFRS 15 point-in-time) — matches reference software.'
      },
      {
        id:'commitment',
        kind:'commitment',
        label:'Commitment Fee',
        // UK loan convention: commitment fee = 35% × current margin × undrawn × dcf.
        // The "0.35" in the requirements sheet means 35% (of margin), not 0.35% flat.
        // Engine resolves margin from the marginSchedule + ESG adjustment for each day.
        mode:'marginLinked',
        marginMultiple: 0.35,
        base:'undrawn',
        frequency:'quarterly',
        paymentSchedule:'lastDayOfEach3MonthPeriod',
        accrueFrom:'2024-10-08',
        accrueTo:'2029-10-10',                 // through availability period
        ifrs:'IFRS15-overTime',
        notes:'35% of margin × undrawn commitment × dcf. Ratchets and ESG adjustment flow through automatically.'
      }
    ],
    // ---- IFRS 9 classification ---------------------------------------
    ifrs: {
      ifrs9Classification:'AmortisedCost',
      sppiPassed: true,
      businessModel:'HoldToCollect',
      ecLStage: 1,
      pdAnnual: 0.005,
      lgd: 0.40
    },
    type:'simpleDaily',                      // base type; SONIA coupon driven by ratchet table
    preset:'Libra 2 · GBP SONIA + Ratcheted Margin (IFRS 9/15 fees)'
  },
  {
    // ----------------------------------------------------------------
    // Libra 3 — same underlying loan structure as Libra 2, with an
    // IFRS 9 §6 Cash Flow Hedge applied. Demonstrates hedge accounting:
    //   - Pay-fixed receive-floating GBP IRS converting the SONIA
    //     exposure to a synthetic-fixed-rate position
    //   - 95% effective per IFRS 9 §6.4 prospective testing
    //   - Effective portion → 35000 Cash Flow Hedge Reserve (OCI)
    //   - Ineffective portion → 45100 Hedge Ineffectiveness P&L
    //   - Reclassification on each settlement date drains the reserve
    //     to P&L matching the hedged cashflow as it occurs
    // Libra 2 stays as the original requirements XLSX example (no hedge);
    // Libra 3 demonstrates the hedge accounting capability separately.
    // ----------------------------------------------------------------
    id:'libra3',
    positionId:'POS-NWF-LIBRA3-100', securityId:'SEC-LIBRA3-HSBC-FACB4-CFH',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Libra 3',
    position:'NWF 100% Bilateral Position · Libra 3 (with CFH)',
    incomeSecurity:'HSBC Facility B4 — Libra 3 (Compounded SONIA + Ratcheted Margin · CFH IRS)',
    counterpartyId:'SP024', transactionId:'SP024',
    bilateralFlag:'Bilateral', agentName:'HSBC Bank', currency:'GBP',
    faceValue: 25_000_000, purchasePrice: 25_000_000, commitment: 25_000_000,
    settlementDate: '2024-10-08', availabilityEnd: '2029-10-10', maturityDate: '2031-10-10',
    accrualDayCountExclusive: false, paydateDayCountInclusive: true, interestPreviousDay: false,
    dayBasis: 'ACT/365', businessDayConvention:'modifiedFollowing',
    holidayCalendar: 'ukBank', skipHolidays: false,
    coupon: { type:'SONIA', fixedRate: 0, floatingRate: 0, spread: 0, floor: null, cap: null },
    rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5, rounding: 5 },
    marginSchedule: [
      { from:'2024-10-08', to:'2025-03-17', marginBps: 400 },
      { from:'2025-03-18', to:'2025-05-21', marginBps: 425 },
      { from:'2025-05-22', to:'2026-03-17', marginBps: 450 },
      { from:'2026-03-18', to:'2027-03-17', marginBps: 450 },
      { from:'2027-03-18', to:'2028-03-17', marginBps: 475 },
      { from:'2028-03-18', to:'2029-03-17', marginBps: 500 },
      { from:'2029-03-18', to:'2030-03-21', marginBps: 525 },
      { from:'2030-03-22', to:'2031-10-10', marginBps: 525 }
    ],
    esgAdjustment: { from:'2025-05-22', deltaBps: -2.5 },
    pik: { enabled:false, rate:0, capitalizationFrequency:'Monthly' },
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-02-17', type:'draw', amount: 15_000_000, drawdownId:'SP024_4', status:'actual'   },
      { date:'2026-06-30', type:'draw', amount: 10_000_000, drawdownId:'SP024_1', status:'forecast' }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    fees: [
      { id:'arrangement', kind:'arrangement', label:'Arrangement Fee',
        mode:'percent', rate: 0.0175, base:'commitment',
        frequency:'oneOff', paymentDate:'2024-10-13',
        ifrs:'IFRS15-pointInTime' },
      { id:'commitment', kind:'commitment', label:'Commitment Fee',
        mode:'marginLinked', marginMultiple: 0.35, base:'undrawn',
        frequency:'quarterly', paymentSchedule:'lastDayOfEach3MonthPeriod',
        accrueFrom:'2024-10-08', accrueTo:'2029-10-10',
        ifrs:'IFRS15-overTime' }
    ],
    ifrs: {
      ifrs9Classification:'AmortisedCost', sppiPassed:true,
      businessModel:'HoldToCollect',
      ecLStage: 1, pdAnnual: 0.005, lgd: 0.40
    },
    // ---- IFRS 9 hedge accounting (§6) — Cash Flow Hedge ---------------
    hedge: {
      type:'CFH',
      notional: 25_000_000,
      fixedRate: 0.0500,                       // pay-fixed leg
      floatingRate: 0.0475,                    // receive-floating SONIA leg
      effectivenessRatio: 0.95,                // 95% effective per IFRS 9 §6.4
      fairValueSchedule: [
        { date:'2024-10-08', mtm:        0 },
        { date:'2025-06-30', mtm:  250_000 },
        { date:'2026-06-30', mtm:  600_000 },
        { date:'2027-06-30', mtm:  850_000 },
        { date:'2028-06-30', mtm:  400_000 },
        { date:'2029-06-30', mtm: -150_000 },
        { date:'2030-06-30', mtm: -350_000 },
        { date:'2031-06-30', mtm: -500_000 },
        { date:'2031-10-10', mtm:        0 }
      ],
      settlementDates: [
        '2025-06-30','2025-12-30','2026-06-30','2026-12-30',
        '2027-06-30','2027-12-30','2028-06-30','2028-12-30',
        '2029-06-30','2029-12-30','2030-06-30','2030-12-30',
        '2031-06-30','2031-10-10'
      ]
    },
    type:'simpleDaily',
    preset:'Libra 3 · Same as Libra 2 + IFRS 9 Cash Flow Hedge (95% effective IRS)'
  },
  {
    // ----------------------------------------------------------------
    // Volt — financial guarantee on a £1bn underlying loan (covered £800m)
    // Source: NEW INCOME Calculation requirements.xlsx · Guarantee Example
    //
    // Single guarantee covering an underlying loan from Bank of America.
    // Income to NWF = guarantee fee on drawn covered portion + NWF commitment
    // fee on undrawn covered portion + arrangement fee (IFRS 9, capitalised).
    // Underlying loan: SONIA + 0.84% margin per annum, scheduled repayments.
    // ----------------------------------------------------------------
    id:'voltGuarantee',
    positionId:'POS-NWF-VOLT-GUAR', securityId:'SEC-VOLT-GP017-FINGUAR',
    instrumentKind:'guarantee',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Volt',
    position:'NWF Guarantor Position · Volt covered tranche',
    incomeSecurity:'Volt Financial Guarantee on £1bn BoA Loan (£800m covered)',
    counterpartyId:'CP0112',
    transactionId:'GP017 & GP018',
    bilateralFlag:'Bilateral',
    agentName:'Bank of America',
    currency:'GBP',
    // For a guarantee instrument we treat:
    //   faceValue / commitment = total facility (£1bn)
    //   coveredAmount          = guaranteed portion (£800m)
    faceValue:    1_000_000_000,
    purchasePrice: 0,                          // no principal investment
    commitment:   1_000_000_000,
    coveredAmount: 800_000_000,
    settlementDate: '2025-12-18',              // signing
    availabilityEnd:'2028-12-18',              // 36-month availability
    maturityDate:   '2037-12-17',              // termination
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/365',
    businessDayConvention:'modifiedFollowing',
    holidayCalendar:'ukBank',
    skipHolidays:false,
    // Underlying-loan coupon — informational here; income is driven by fees.
    coupon: { type:'SONIA', fixedRate:0, floatingRate:0, spread: 0.0084, floor:null, cap:null },
    rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5, rounding: 5 },
    marginSchedule: [
      // Underlying loan margin = 0.84% flat for covered tranche
      { from:'2025-12-18', to:'2037-12-17', marginBps: 84 }
    ],
    pik: { enabled:false, rate:0 },
    principalRepayment:'Scheduled',
    // Covered-tranche disbursement schedule + 18-tranche repayment ladder
    // Drawdown profile: 6 ratable tranches of £133,333,333.33 (= £800m / 6)
    // over the 3-year availability period — matches the reference SP023 ledger.
    // The contractual disbursement table from the requirements sheet has 3
    // lumpy tranches (£400m + £200m + £200m); the reference software books
    // them ratably across the 6 interest periods.
    principalSchedule: [
      { date:'2026-06-30', type:'draw', amount: 133_333_333.33, status:'actual'   },
      { date:'2026-12-31', type:'draw', amount: 133_333_333.33, status:'actual'   },
      { date:'2027-06-30', type:'draw', amount: 133_333_333.33, status:'forecast' },
      { date:'2027-12-31', type:'draw', amount: 133_333_333.33, status:'forecast' },
      { date:'2028-06-30', type:'draw', amount: 133_333_333.33, status:'forecast' },
      { date:'2028-12-29', type:'draw', amount: 133_333_333.35, status:'forecast' },
      // Repayments — 18 × £44,444,444.44 = £800m (matches reference ledger
      // exactly; contractual amounts are slightly different at £44,444,800
      // per period but the reference uses round £800m / 18).
      { date:'2029-06-29', type:'repayment', amount: 44_444_444.44 },
      { date:'2029-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2030-06-28', type:'repayment', amount: 44_444_444.44 },
      { date:'2030-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2031-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2031-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2032-05-28', type:'repayment', amount: 44_444_444.44 },
      { date:'2032-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2033-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2033-12-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2034-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2034-12-29', type:'repayment', amount: 44_444_444.44 },
      { date:'2035-06-29', type:'repayment', amount: 44_444_444.44 },
      { date:'2035-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2036-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2036-12-31', type:'repayment', amount: 44_444_444.44 },
      { date:'2037-06-30', type:'repayment', amount: 44_444_444.44 },
      { date:'2037-12-19', type:'repayment', amount: 44_444_444.52 }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    fees: [
      {
        id:'arrangement',
        kind:'arrangement',
        label:'Arrangement Fee',
        mode:'percent',                       // 0.24% × covered (£800m) = £1.92m
        rate: 0.0024,
        base:'covered',
        frequency:'oneOff',
        paymentDate:'2025-12-30',
        ifrs:'IFRS9-EIR',
        notes:'0.24% of covered portion paid 30/12/2025 — IFRS 9 deferred and accreted.'
      },
      {
        id:'guarantee',
        kind:'guarantee',
        label:'Guarantee Fee',
        mode:'percent',                       // 0.5% p.a. × drawn covered amount
        rate: 0.005,
        base:'drawn',                          // engine maps drawn = current loan balance
        frequency:'semiAnnual',
        paymentSchedule:'lastDayOfInterestPeriod',
        accrueFrom:'2026-04-01',               // accrual starts at first drawdown
        accrueTo:'2037-12-17',
        ifrs:'IFRS15-overTime',
        notes:'0.5% p.a. on drawn covered portion. Paid every 6m on last day of interest period.'
      },
      {
        id:'nwfCommitment',
        kind:'commitment',
        label:'NWF Commitment Fee',
        mode:'percent',                       // 35% × guarantee fee = 0.175% × undrawn
        rate: 0.00175,
        base:'undrawn',                        // undrawn portion of covered tranche
        frequency:'semiAnnual',
        paymentSchedule:'every6mFromSigning',
        accrueFrom:'2025-12-18',
        accrueTo:'2028-12-18',                 // through availability period
        ifrs:'IFRS15-overTime',
        notes:'35% of guarantee fee × undrawn covered portion. IFRS 15 — over time during availability.'
      }
    ],
    ifrs: {
      ifrs9Classification:'AmortisedCost',     // financial guarantee accounted at amortised cost
      sppiPassed:true,
      businessModel:'HoldToCollect',
      ecLStage: 1,
      pdAnnual: 0.0035,
      lgd: 0.45
    },
    type:'simpleDaily',
    preset:'Volt · £1bn Financial Guarantee (covered £800m, IFRS 9/15 fees)'
  },
  {
    // ----------------------------------------------------------------
    // XYZ Buyout Fund — LP commitment to a renewable infrastructure fund
    // Source: NEW INCOME Calculation requirements.xlsx · Equity Example #1
    //
    // £50m commitment to a closed-end LP. Capital calls staggered over 3
    // years, fund term 10y + 2y extension. Income to the LP comes via:
    //   - distributions (modelled as paydowns / not income)
    //   - dividend income (one-off recognition events)
    //   - capital gains at exit (not modelled here)
    // GP charges:
    //   - 1.75% management fee p.a. on committed during years 1-5
    //   - 1.25% management fee p.a. on invested cost from year 5 onwards
    //   - 8% IRR preferred return (out of scope for this calculator)
    // Note: management fees are an EXPENSE to the LP, modelled as
    // negative-rate "fees" so the calculator surfaces them with their
    // own line. IFRS 9 / 15 classification is "FVTPL — equity at fair value"
    // since SPPI fails for equity (no contractual cashflows).
    // ----------------------------------------------------------------
    id:'xyzBuyoutFund',
    positionId:'POS-NWFE-XYZ-LP', securityId:'SEC-XYZ-BUYOUT-LPINT',
    instrumentKind:'equity-fund',
    legalEntity:'NWF Renewable Equity', leid: 51,
    deal:'XYZ Buyout Fund (GBP)',
    position:'NWFE LP Subscription · £50m commitment',
    incomeSecurity:'XYZ Buyout Fund (GBP) — Limited Partnership Interest',
    generalPartner:'WXY Partners LLP',
    fundType:'LP / Closed-end',
    sectorFocus:'Solar, Fibre Infrastructure',
    currency:'GBP',
    faceValue:    50_000_000,                  // commitment
    purchasePrice: 50_000_000,
    commitment:   50_000_000,
    settlementDate:'2026-01-15',               // first close (illustrative)
    availabilityEnd:'2031-01-15',              // 5-year investment period
    maturityDate:   '2038-01-15',              // 10y term + assume 2y extension exercised
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/365',
    coupon: { type:'Fixed', fixedRate:0, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    principalRepayment:'Scheduled',
    // Capital calls staggered over 3 years; distributions in years 7-10
    principalSchedule: [
      // Capital calls (drawdowns from LP perspective)
      { date:'2026-03-31', type:'draw',    amount: 12_500_000, status:'actual'   },  // 25%
      { date:'2026-09-30', type:'draw',    amount: 10_000_000, status:'forecast' },  // 20%
      { date:'2027-06-30', type:'draw',    amount: 12_500_000, status:'forecast' },  // 25%
      { date:'2027-12-31', type:'draw',    amount:  7_500_000, status:'forecast' },  // 15%
      { date:'2028-06-30', type:'draw',    amount:  5_000_000, status:'forecast' },  // 10%
      { date:'2028-12-31', type:'draw',    amount:  2_500_000, status:'forecast' },  // 5%
      // Realisations (distributions back to LP — illustrative)
      { date:'2032-12-31', type:'paydown', amount: 10_000_000 },
      { date:'2034-12-31', type:'paydown', amount: 20_000_000 },
      { date:'2036-12-31', type:'paydown', amount: 20_000_000 },
      { date:'2037-12-31', type:'paydown', amount: 10_000_000 }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    fees: [
      // 1.75% on COMMITTED during the 5-year investment period
      {
        id:'mgmtFeeInvestmentPeriod',
        kind:'other',
        label:'Management Fee (Investment Period)',
        mode:'percent',
        rate: 0.0175,
        base:'commitment',
        frequency:'quarterly',
        accrueFrom:'2026-01-15',
        accrueTo:'2031-01-15',
        ifrs:'IFRS15-overTime',
        notes:'1.75% p.a. on committed capital during 5-year investment period (expense to LP).'
      },
      // 1.25% on INVESTED COST after the investment period
      {
        id:'mgmtFeePostInvestment',
        kind:'other',
        label:'Management Fee (Post-Investment)',
        mode:'percent',
        rate: 0.0125,
        base:'drawn',                          // drawn balance ≈ invested cost
        frequency:'quarterly',
        accrueFrom:'2031-01-16',
        accrueTo:'2038-01-15',
        ifrs:'IFRS15-overTime',
        notes:'1.25% p.a. on invested cost from year 5 onwards (step-down).'
      }
    ],
    ifrs: {
      ifrs9Classification:'FVTPL',             // equity instruments fail SPPI
      sppiPassed:false,
      businessModel:'Other',
      ecLStage: null,                          // not applicable for FVTPL equity
      pdAnnual: null,
      lgd: null,
      fairValueLevel:'Level 3',                // private fund interest
      navFrequency:'Quarterly',
      preferredReturn: 0.08,
      gpCarry: 0.20
    },
    type:'simpleDaily',
    preset:'XYZ Buyout Fund · £50m LP Commitment (Renewables, 1.75/1.25% mgmt fee)'
  },
  {
    // ----------------------------------------------------------------
    // ABCDEF Software Ltd — Series C direct equity stake
    // Source: NEW INCOME Calculation requirements.xlsx · Equity Example #2
    //
    // £100m ordinary shares for 9.09% post-money. Pre-money £120m fully
    // diluted. Non-cumulative, as-declared dividends. 10y trade-sale exit.
    // Quarterly fair value updates (Level 3 — comparable transactions).
    // For the income calculator we model:
    //   - Initial drawdown = £100m investment
    //   - Dividends as point-in-time IFRS 15 fee recognition events
    //   - No coupon, no maturity-based amortization (FVTPL equity)
    // ----------------------------------------------------------------
    id:'abcdefSeriesC',
    positionId:'POS-NWFE-ABCDEF-SC', securityId:'SEC-ABCDEF-SERIES-C-ORD',
    instrumentKind:'equity-direct',
    legalEntity:'NWF Renewable Equity', leid: 51,
    deal:'ABCDEF Software Ltd',
    position:'NWFE Series C Subscription · £100m · 9.09% post-money',
    incomeSecurity:'ABCDEF Software Ltd — Series C Ordinary Shares',
    counterpartyId:'ABCDEF-LTD',
    currency:'GBP',
    faceValue:    100_000_000,                 // committed = invested
    purchasePrice: 100_000_000,
    commitment:   100_000_000,
    settlementDate:'2026-04-01',
    maturityDate:   '2036-04-01',              // 10y trade-sale horizon
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis: 'ACT/365',
    coupon: { type:'Fixed', fixedRate:0, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    principalRepayment:'AtMaturity',
    principalSchedule: [
      { date:'2026-04-01', type:'initial', amount: 100_000_000 }
    ],
    amortization: { method:'none' },
    nonUseFee: { enabled:false, rate:0 },
    fees: [
      // Illustrative declared dividend events — point-in-time IFRS 15 recognition
      {
        id:'dividend2027',
        kind:'other',
        label:'Dividend Income FY2027',
        mode:'flat',
        amount: 750_000,
        frequency:'oneOff',
        paymentDate:'2027-09-30',
        ifrs:'IFRS15-pointInTime',
        notes:'Non-cumulative, as-declared. Recognised when right to receive established.'
      },
      {
        id:'dividend2028',
        kind:'other',
        label:'Dividend Income FY2028',
        mode:'flat',
        amount: 1_250_000,
        frequency:'oneOff',
        paymentDate:'2028-09-28',
        ifrs:'IFRS15-pointInTime'
      },
      {
        id:'dividend2030',
        kind:'other',
        label:'Dividend Income FY2030',
        mode:'flat',
        amount: 2_000_000,
        frequency:'oneOff',
        paymentDate:'2030-09-30',
        ifrs:'IFRS15-pointInTime'
      }
    ],
    capTable: {
      preMoneyValuation: 120_000_000,
      postMoneyOwnership: 0.0909,
      founders: 0.45,
      existingInvestors: 0.359,
      esopUnallocated: 0.10
    },
    ifrs: {
      ifrs9Classification:'FVTPL',             // SPPI fails — ordinary shares
      sppiPassed:false,
      businessModel:'Other',
      ecLStage: null,
      pdAnnual: null,
      lgd: null,
      fairValueLevel:'Level 3',                // private company, market-comparables
      navFrequency:'Quarterly',
      protectiveProvisions:['M&A','New Senior Securities','Budget >10% Variance','Related-Party Tx'],
      boardRights:'1 observer seat (no vote)'
    },
    type:'simpleDaily',
    preset:'ABCDEF Series C · £100m direct equity (9.09% post-money, FVTPL Level 3)'
  },
  {
    // ----------------------------------------------------------------
    // Suffolk Solar — multi-tranche infrastructure loan (Fixed + Floating)
    // Demonstrates scenario #10: fixed + floating tranches in one transaction.
    // £100m total facility split 50/50:
    //   - Tranche A: £50m fixed at 6.5% over 7 years (30/360)
    //   - Tranche B: £50m SONIA + 350 bps over 7 years (ACT/365)
    // ----------------------------------------------------------------
    id:'suffolkMultiTranche',
    positionId:'POS-NWF-SUFFOLK-MT', securityId:'SEC-SUFFOLK-SOLAR-MT',
    instrumentKind:'loan',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Suffolk Solar Phase 2',
    position:'NWF 100% Bilateral Position · Suffolk Solar',
    incomeSecurity:'Suffolk Solar Multi-Tranche Facility (£50m Fixed + £50m SONIA)',
    currency:'GBP',
    faceValue:    100_000_000,
    purchasePrice: 100_000_000,
    commitment:   100_000_000,
    settlementDate:'2026-01-15',
    maturityDate:   '2033-01-15',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    holidayCalendar:'ukBank',
    skipHolidays:false,
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.005, lgd:0.40 },
    // ---- TRANCHES ----
    tranches: [
      {
        id:'trancheA-fixed',
        label:'Tranche A · Fixed',
        faceValue: 50_000_000,
        purchasePrice: 50_000_000,
        commitment:    50_000_000,
        coupon: { type:'Fixed', fixedRate: 0.065, floatingRate:0, spread:0, floor:null, cap:null },
        dayBasis: '30/360',
        principalRepayment:'AtMaturity',
        principalSchedule: [
          { date:'2026-01-15', type:'initial', amount: 50_000_000 }
        ]
      },
      {
        id:'trancheB-floating',
        label:'Tranche B · SONIA + 350',
        faceValue: 50_000_000,
        purchasePrice: 50_000_000,
        commitment:    50_000_000,
        coupon: { type:'SONIA', fixedRate:0, floatingRate:0, spread: 0.0350, floor:null, cap:null },
        rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5, rounding: 5 },
        marginSchedule: [
          { from:'2026-01-15', to:'2033-01-15', marginBps: 350 }
        ],
        dayBasis: 'ACT/365',
        principalRepayment:'AtMaturity',
        principalSchedule: [
          { date:'2026-01-15', type:'initial', amount: 50_000_000 }
        ]
      }
    ],
    preset:'Suffolk Solar · £100m Multi-Tranche (£50m Fixed 6.5% + £50m SONIA+350)'
  },
  {
    // ----------------------------------------------------------------
    // Volt Multi-Loan — financial guarantee covering MULTIPLE underlying loans
    // Demonstrates scenario G1: single guarantee, multiple underlyings.
    // Total covered amount £600m across two underlying loans:
    //   - Underlying 1: £400m, SONIA + 0.84% margin (covered tranche)
    //   - Underlying 2: £200m, Fixed 5.5% (covered tranche)
    // Single guarantee fee structure applies to both.
    // ----------------------------------------------------------------
    id:'voltMultiLoan',
    positionId:'POS-NWF-VOLT-MLG', securityId:'SEC-VOLT-GP022-MULTILOAN',
    instrumentKind:'guarantee',
    legalEntity:'NWF Sustainable Infrastructure', leid: 42,
    deal:'Volt — Multi-Loan Guarantee',
    position:'NWF Guarantor Position · Volt multi-loan covered',
    incomeSecurity:'Volt Multi-Loan Financial Guarantee (£600m covered, 2 underlyings)',
    counterpartyId:'CP0112',
    transactionId:'GP022',
    bilateralFlag:'Bilateral',
    agentName:'Bank of America',
    currency:'GBP',
    faceValue:    750_000_000,
    purchasePrice: 0,
    commitment:   750_000_000,
    coveredAmount: 600_000_000,
    settlementDate:'2026-01-15',
    availabilityEnd:'2029-01-15',
    maturityDate:   '2036-01-15',
    accrualDayCountExclusive: false,
    paydateDayCountInclusive: true,
    interestPreviousDay: false,
    dayBasis:'ACT/365',
    holidayCalendar:'ukBank',
    skipHolidays:false,
    coupon: { type:'Fixed', fixedRate:0, floatingRate:0, spread:0, floor:null, cap:null },
    pik: { enabled:false, rate:0 },
    nonUseFee: { enabled:false, rate:0 },
    amortization: { method:'none' },
    type:'simpleDaily',
    ifrs: { ifrs9Classification:'AmortisedCost', sppiPassed:true, businessModel:'HoldToCollect', ecLStage:1, pdAnnual:0.0035, lgd:0.45 },
    // ---- UNDERLYING LOANS (each contributes to the aggregate covered drawn) ----
    underlyingLoans: [
      {
        id:'underlying1-sonia',
        label:'Underlying 1 · SONIA + 84',
        faceValue: 400_000_000,
        commitment: 400_000_000,
        coveredAmount: 400_000_000,
        coupon: { type:'SONIA', fixedRate:0, floatingRate:0, spread: 0.0084, floor:null, cap:null },
        rfr: { index:'SONIA', baseRate: 0.0475, lookbackDays: 5, rounding: 5 },
        marginSchedule: [{ from:'2026-01-15', to:'2036-01-15', marginBps: 84 }],
        dayBasis: 'ACT/365',
        principalRepayment:'Scheduled',
        principalSchedule: [
          { date:'2026-06-30', type:'draw',      amount: 100_000_000, status:'actual'   },
          { date:'2027-06-30', type:'draw',      amount: 150_000_000, status:'forecast' },
          { date:'2028-06-30', type:'draw',      amount: 150_000_000, status:'forecast' },
          { date:'2031-06-30', type:'repayment', amount: 100_000_000 },
          { date:'2033-06-30', type:'repayment', amount: 150_000_000 },
          { date:'2036-01-15', type:'repayment', amount: 150_000_000 }
        ]
      },
      {
        id:'underlying2-fixed',
        label:'Underlying 2 · Fixed 5.5%',
        faceValue: 200_000_000,
        commitment: 200_000_000,
        coveredAmount: 200_000_000,
        coupon: { type:'Fixed', fixedRate: 0.055, floatingRate:0, spread:0, floor:null, cap:null },
        dayBasis: '30/360',
        principalRepayment:'AtMaturity',
        principalSchedule: [
          { date:'2026-12-31', type:'draw',      amount: 200_000_000, status:'actual'   },
          { date:'2036-01-15', type:'repayment', amount: 200_000_000 }
        ]
      }
    ],
    fees: [
      {
        id:'arrangement',
        kind:'arrangement',
        label:'Arrangement Fee',
        mode:'percent',
        rate: 0.0024,
        base:'covered',
        frequency:'oneOff',
        paymentDate:'2026-01-30',
        ifrs:'IFRS15-pointInTime',
        notes:'0.24% × £600m covered = £1.44m on payment date.'
      },
      {
        id:'guarantee',
        kind:'guarantee',
        label:'Guarantee Fee',
        mode:'percent',
        rate: 0.005,
        base:'drawn',
        frequency:'semiAnnual',
        accrueFrom:'2026-06-30',
        accrueTo:'2036-01-15',
        ifrs:'IFRS15-overTime',
        // FEE-RATE RATCHET: 0.5% for first 5 years, then steps to 0.6% from 2031
        feeRateSchedule: [
          { from:'2026-06-30', to:'2030-12-31', rate: 0.0050 },
          { from:'2031-01-01', to:'2036-01-15', rate: 0.0060 }
        ],
        notes:'0.5% p.a. on drawn aggregate covered, ratcheting to 0.6% from 2031.'
      }
    ],
    preset:'Volt Multi-Loan · £600m covered across 2 underlyings (SONIA + Fixed)'
  }
];


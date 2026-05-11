#!/usr/bin/env python3
"""
build_user_guide_pdf.py — Build the Loan Module Integration Layer user guide PDF.

Output: Loan-Module-Integration-Layer-User-Guide.pdf

Design goals:
  * Cover page + TOC
  * Two clearly separated reference parts: CALCULATIONS and FUNCTIONALITY
  * Coloured callout boxes for every formula and every UI action
  * Tables with banded styling for readability
  * Page numbers + running header

Run:
  pip3 install reportlab --break-system-packages
  python3 build_user_guide_pdf.py
"""

import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

# ─── REGISTER UNICODE FONTS ──────────────────────────────────────────────────
# Override the standard Helvetica / Courier names so every existing style picks
# up a font that has the math, Greek, subscript, and currency glyphs we use.
def _register_unicode_fonts():
    candidates = [
        ('/usr/share/fonts/truetype/dejavu', 'DejaVuSans', 'DejaVuSansMono'),
        ('/Library/Fonts',                   'DejaVuSans', 'DejaVuSansMono'),
        ('/usr/share/fonts/truetype/liberation', 'LiberationSans', 'LiberationMono'),
    ]
    for root, sans, mono in candidates:
        sans_reg = os.path.join(root, f'{sans}.ttf')
        if os.path.exists(sans_reg):
            pdfmetrics.registerFont(TTFont('Helvetica',           f'{root}/{sans}.ttf'))
            pdfmetrics.registerFont(TTFont('Helvetica-Bold',      f'{root}/{sans}-Bold.ttf'))
            pdfmetrics.registerFont(TTFont('Helvetica-Oblique',   f'{root}/{sans}-Oblique.ttf'))
            pdfmetrics.registerFont(TTFont('Helvetica-BoldOblique', f'{root}/{sans}-BoldOblique.ttf'))
            pdfmetrics.registerFont(TTFont('Courier',             f'{root}/{mono}.ttf'))
            pdfmetrics.registerFont(TTFont('Courier-Bold',        f'{root}/{mono}-Bold.ttf'))
            # Hook bold/italic resolution for HTML <b>/<i> inside Paragraphs
            addMapping('Helvetica', 0, 0, 'Helvetica')
            addMapping('Helvetica', 1, 0, 'Helvetica-Bold')
            addMapping('Helvetica', 0, 1, 'Helvetica-Oblique')
            addMapping('Helvetica', 1, 1, 'Helvetica-BoldOblique')
            addMapping('Courier',   0, 0, 'Courier')
            addMapping('Courier',   1, 0, 'Courier-Bold')
            print(f'  · Using {sans} from {root}')
            return
    print('  · No Unicode TTF found — keeping standard 14 fonts (boxes may appear)')

_register_unicode_fonts()

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, NextPageTemplate, PageBreak,
    Paragraph, Spacer, Table, TableStyle, KeepTogether, Image,
    HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfgen import canvas
from datetime import datetime

# ─── PALETTE ─────────────────────────────────────────────────────────────────
NAVY        = colors.HexColor('#21295C')   # primary
TEAL        = colors.HexColor('#1C7293')   # accent
MINT        = colors.HexColor('#4ECDC4')   # success
AMBER       = colors.HexColor('#F4A261')   # warning
INK         = colors.HexColor('#1A1F36')   # body text
SLATE       = colors.HexColor('#5A6478')   # secondary text
RULE        = colors.HexColor('#D4DAE3')   # dividers
CARD_BG     = colors.HexColor('#F5F8FB')   # callout background
CALC_BG     = colors.HexColor('#EEF6FA')   # calculation callout
FORMULA_BG  = colors.HexColor('#FFF8E1')   # formula box
CODE_BG     = colors.HexColor('#F4F4F7')   # code block
BAND        = colors.HexColor('#F8FAFC')   # table band
WHITE       = colors.white

import os as _os
OUTPUT_FILE = _os.environ.get(
    'GUIDE_PDF_OUT',
    '/Users/ferhatansari/Claude Cowork folder/Claude Income Calculator/Loan-Module-Integration-Layer-User-Guide.pdf'
)
VERSION = '2026-05-11'

# ─── STYLES ──────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def s(name, parent='BodyText', **kw):
    base = styles[parent] if parent in styles.byName else styles['BodyText']
    return ParagraphStyle(name=name, parent=base, **kw)

H_TITLE = s('HTitle', fontName='Helvetica-Bold', fontSize=32, leading=38,
            textColor=WHITE, alignment=TA_LEFT, spaceAfter=8)
H_SUB   = s('HSub', fontName='Helvetica', fontSize=14, leading=18,
            textColor=WHITE, alignment=TA_LEFT, spaceAfter=24)
H_KICK  = s('HKick', fontName='Helvetica', fontSize=10, leading=14,
            textColor=colors.HexColor('#C2CCE0'), alignment=TA_LEFT, spaceAfter=6,
            tracking=2)

H1 = s('H1', fontName='Helvetica-Bold', fontSize=20, leading=24,
       textColor=NAVY, spaceBefore=18, spaceAfter=10, keepWithNext=1)
H2 = s('H2', fontName='Helvetica-Bold', fontSize=14, leading=18,
       textColor=NAVY, spaceBefore=14, spaceAfter=6, keepWithNext=1)
H3 = s('H3', fontName='Helvetica-Bold', fontSize=11, leading=14,
       textColor=TEAL, spaceBefore=10, spaceAfter=4, keepWithNext=1)
H4 = s('H4', fontName='Helvetica-Bold', fontSize=10, leading=13,
       textColor=INK, spaceBefore=8, spaceAfter=3, keepWithNext=1)

BODY = s('Body', fontName='Helvetica', fontSize=9.5, leading=13.5,
         textColor=INK, alignment=TA_JUSTIFY, spaceAfter=6)
BODY_TIGHT = s('BodyTight', parent='Body', fontName='Helvetica', fontSize=9.5,
               leading=12.5, textColor=INK, alignment=TA_LEFT, spaceAfter=2)
BULLET = s('Bullet', fontName='Helvetica', fontSize=9.5, leading=13,
           textColor=INK, leftIndent=12, bulletIndent=0, spaceAfter=2)
LEAD = s('Lead', fontName='Helvetica', fontSize=11, leading=16,
         textColor=SLATE, spaceAfter=10, alignment=TA_LEFT)
SMALL = s('Small', fontName='Helvetica', fontSize=8.5, leading=11,
          textColor=SLATE, alignment=TA_LEFT)
NOTE = s('Note', fontName='Helvetica-Oblique', fontSize=9, leading=12,
         textColor=SLATE, alignment=TA_LEFT, spaceAfter=6)

# Inline code / formula
CODE = s('Code', fontName='Courier', fontSize=9, leading=12,
         textColor=INK, alignment=TA_LEFT)
FORMULA = s('Formula', fontName='Courier-Bold', fontSize=10, leading=14,
            textColor=NAVY, alignment=TA_LEFT)

LABEL = s('Label', fontName='Helvetica-Bold', fontSize=8, leading=10,
          textColor=TEAL, alignment=TA_LEFT, spaceAfter=2)
TBL_HEAD = s('TblHead', fontName='Helvetica-Bold', fontSize=9, leading=11,
             textColor=WHITE, alignment=TA_LEFT)
TBL_CELL = s('TblCell', fontName='Helvetica', fontSize=8.5, leading=11,
             textColor=INK, alignment=TA_LEFT)
TBL_CELL_RT = s('TblCellRt', parent='TblCell', fontName='Helvetica', fontSize=8.5,
                leading=11, textColor=INK, alignment=TA_RIGHT)

# ─── HELPERS ─────────────────────────────────────────────────────────────────
def hrule(color=RULE, thickness=0.5, space_before=4, space_after=4):
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceBefore=space_before, spaceAfter=space_after)

def section_header(num, title, subtitle=None, story=None):
    """Big section header — adds a navy bar with white text + registers a TOC entry."""
    rows = [[Paragraph(f'<font color="white">PART {num}</font>', H_KICK),
             Paragraph(f'<font color="white">{title}</font>',
                       ParagraphStyle('SectionTitle', fontName='Helvetica-Bold',
                                      fontSize=22, leading=26, textColor=WHITE))]]
    t = Table(rows, colWidths=[60*mm, 110*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    # Marker so GuideDoc.afterFlowable can emit a level-0 TOC entry
    t._tocEntry = (0, f'Part {num}. {title}')
    story.append(t)
    if subtitle:
        story.append(Spacer(1, 6))
        story.append(Paragraph(subtitle, LEAD))
    story.append(Spacer(1, 6))

def callout(label, body_html, bg=CALC_BG, border=TEAL, label_color=None):
    """Coloured callout box with a header label."""
    if label_color is None:
        label_color = border
    inner = [
        Paragraph(f'<font color="#{label_color.hexval()[2:]}"><b>{label.upper()}</b></font>',
                  ParagraphStyle('CalloutLbl', fontName='Helvetica-Bold', fontSize=8,
                                 leading=11, alignment=TA_LEFT, spaceAfter=4)),
        Paragraph(body_html, BODY_TIGHT),
    ]
    t = Table([[inner]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('LINEBEFORE', (0, 0), (0, -1), 3, border),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return t

def formula_box(name, formula_str, where_html=None, posts_html=None):
    """Highlighted formula box used in CALCULATIONS section."""
    cells = [[Paragraph(f'<b>{name}</b>',
                        ParagraphStyle('FormulaName', fontName='Helvetica-Bold',
                                       fontSize=10, leading=13, textColor=NAVY))]]
    cells.append([Paragraph(f'<font face="Courier-Bold" color="#21295C">{formula_str}</font>',
                            ParagraphStyle('Formula', fontName='Courier-Bold',
                                           fontSize=10.5, leading=15, textColor=NAVY,
                                           alignment=TA_LEFT))])
    if where_html:
        cells.append([Paragraph(f'<b>Where:</b> {where_html}', BODY_TIGHT)])
    if posts_html:
        cells.append([Paragraph(f'<b>Books:</b> {posts_html}', BODY_TIGHT)])
    t = Table(cells, colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), FORMULA_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, AMBER),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t

def data_table(headers, rows, col_widths=None, header_color=NAVY, align_cols=None):
    """Standard data table with header band + alternating rows."""
    data = [[Paragraph(h, TBL_HEAD) for h in headers]]
    for r in rows:
        row_cells = []
        for i, cell in enumerate(r):
            style = TBL_CELL
            if align_cols and i in align_cols:
                style = TBL_CELL_RT
            if isinstance(cell, str):
                row_cells.append(Paragraph(cell, style))
            else:
                row_cells.append(cell)
        data.append(row_cells)
    if col_widths is None:
        col_widths = [170*mm / len(headers)] * len(headers)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    band_cmds = []
    for i in range(1, len(data)):
        if i % 2 == 0:
            band_cmds.append(('BACKGROUND', (0, i), (-1, i), BAND))
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), header_color),
        ('LINEBELOW', (0, 0), (-1, 0), 0.4, header_color),
        ('LINEBELOW', (0, -1), (-1, -1), 0.4, RULE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ] + band_cmds))
    return t

# ─── PAGE TEMPLATES ──────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN = 20 * mm
FRAME_W = PAGE_W - 2 * MARGIN
FRAME_H = PAGE_H - 2 * MARGIN - 10*mm  # leave room for header/footer

class GuideDoc(BaseDocTemplate):
    def __init__(self, filename, **kw):
        super().__init__(filename, pagesize=A4,
                         leftMargin=MARGIN, rightMargin=MARGIN,
                         topMargin=MARGIN + 5*mm, bottomMargin=MARGIN,
                         title='Loan Module Integration Layer — User Guide',
                         author='NWF / FIS Capital Partners',
                         **kw)
        cover_frame = Frame(MARGIN, MARGIN, FRAME_W, PAGE_H - 2*MARGIN,
                            id='cover', showBoundary=0,
                            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        body_frame = Frame(MARGIN, MARGIN, FRAME_W, FRAME_H, id='body', showBoundary=0,
                           leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id='Cover', frames=[cover_frame], onPage=_cover_decor),
            PageTemplate(id='Body',  frames=[body_frame],  onPage=_body_decor),
        ])
        self._toc_entries = []
        self.toc = TableOfContents()
        self.toc.levelStyles = [
            ParagraphStyle('TOC1', fontName='Helvetica-Bold', fontSize=11,
                           leading=16, textColor=NAVY, leftIndent=0,
                           firstLineIndent=0, spaceAfter=2),
            ParagraphStyle('TOC2', fontName='Helvetica', fontSize=9.5,
                           leading=14, textColor=INK, leftIndent=14,
                           firstLineIndent=0, spaceAfter=0),
        ]

    def afterFlowable(self, flowable):
        """Capture H1/H2 paragraphs + section-header tables for the TOC."""
        # Section-header navy tables carry a _tocEntry marker
        if hasattr(flowable, '_tocEntry'):
            level, text = flowable._tocEntry
            self.notify('TOCEntry', (level, text, self.page))
            return
        if isinstance(flowable, Paragraph):
            text = flowable.getPlainText()
            style = flowable.style.name
            if style == 'H1':
                self.notify('TOCEntry', (0, text, self.page))
            elif style == 'H2':
                self.notify('TOCEntry', (1, text, self.page))


def _cover_decor(canv, doc):
    # Full navy background
    canv.setFillColor(NAVY)
    canv.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Teal accent bar
    canv.setFillColor(TEAL)
    canv.rect(0, PAGE_H - 280, PAGE_W, 6, fill=1, stroke=0)
    # Footer micro-text
    canv.setFillColor(colors.HexColor('#9BA8C6'))
    canv.setFont('Helvetica', 8)
    canv.drawString(MARGIN, 18*mm, f'Version {VERSION}  ·  NWF / FIS Capital Partners  ·  Loan Module Integration Layer')


def _body_decor(canv, doc):
    canv.saveState()
    # Top rule
    canv.setStrokeColor(RULE)
    canv.setLineWidth(0.5)
    canv.line(MARGIN, PAGE_H - MARGIN, PAGE_W - MARGIN, PAGE_H - MARGIN)
    # Running header
    canv.setFillColor(SLATE)
    canv.setFont('Helvetica', 8)
    canv.drawString(MARGIN, PAGE_H - MARGIN + 4, 'Loan Module Integration Layer — User Guide')
    canv.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 4, f'v{VERSION}')
    # Footer
    canv.setStrokeColor(RULE)
    canv.line(MARGIN, MARGIN - 4, PAGE_W - MARGIN, MARGIN - 4)
    canv.setFillColor(SLATE)
    canv.setFont('Helvetica', 8)
    canv.drawString(MARGIN, MARGIN - 12, 'NWF / FIS Capital Partners · Internal use')
    canv.drawRightString(PAGE_W - MARGIN, MARGIN - 12, f'Page {doc.page}')
    canv.restoreState()


# ─── CONTENT ─────────────────────────────────────────────────────────────────
story = []

# ━━━ COVER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(Spacer(1, 70*mm))
story.append(Paragraph('USER GUIDE  ·  REVISED', H_KICK))
story.append(Paragraph('Loan Module<br/>Integration Layer', H_TITLE))
story.append(Spacer(1, 4*mm))
story.append(Paragraph(
    'PortF → PCS / Investran → Workday GL → Reconciliation → PortF Feedback.<br/>'
    'A complete reference to every calculation, every UI action, and every journal '
    'this application produces.',
    H_SUB))
story.append(Spacer(1, 30*mm))

# Bottom of cover — quick stats
COVER_NUM = ParagraphStyle('CoverNum', fontName='Helvetica-Bold', fontSize=32,
                            leading=36, textColor=WHITE, alignment=TA_LEFT)
COVER_LBL = ParagraphStyle('CoverLbl', fontName='Helvetica', fontSize=9,
                            leading=11, textColor=colors.HexColor('#C2CCE0'),
                            alignment=TA_LEFT)
cover_stats = Table([
    [Paragraph('5',       COVER_NUM),
     Paragraph('13',      COVER_NUM),
     Paragraph('26 / 26', COVER_NUM),
     Paragraph('IFRS',    COVER_NUM)],
    [Paragraph('Pipeline stages',      COVER_LBL),
     Paragraph('Seed instruments',     COVER_LBL),
     Paragraph('Capabilities covered', COVER_LBL),
     Paragraph('9 · 13 · 15 aligned',  COVER_LBL)],
], colWidths=[42*mm, 42*mm, 46*mm, 40*mm], rowHeights=[42, 16])
cover_stats.setStyle(TableStyle([
    ('VALIGN',        (0, 0), (-1, 0), 'TOP'),
    ('VALIGN',        (0, 1), (-1, 1), 'TOP'),
    ('LEFTPADDING',   (0, 0), (-1, -1), 0),
    ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
    ('TOPPADDING',    (0, 0), (-1, 0), 0),
    ('TOPPADDING',    (0, 1), (-1, 1), 2),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
]))
story.append(cover_stats)

story.append(NextPageTemplate('Body'))
story.append(PageBreak())

# ━━━ TABLE OF CONTENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(Paragraph('Contents', H1))
story.append(hrule(TEAL, 1, 0, 8))
# Build a static TOC (TableOfContents auto-generation requires multi-pass which is supported)
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName='Helvetica-Bold', fontSize=11, leading=18,
                   textColor=NAVY, spaceAfter=2),
    ParagraphStyle('TOC2', fontName='Helvetica', fontSize=9.5, leading=14,
                   textColor=INK, leftIndent=14, spaceAfter=0),
]
story.append(toc)
story.append(PageBreak())

# ━━━ PART 1 — QUICK REFERENCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(1, 'Quick Reference',
               'One page to find anything. Pipeline at a glance, top calculations, '
               'most-used GL accounts, status chips, and the keyboard-shortcut to every '
               'screen the operator will use.', story)

story.append(Paragraph('Pipeline at a glance', H2))
pipeline_rows = [
    ['1. PortF Inbound',     'Deal team',          'Hand contractual setup + cashflows to PCS',     'Loaded · N days'],
    ['2. PCS / Investran',   'Accounting team',    'Classify, compute EIR / ECL / FV, generate JEs','Ready · N JE rows'],
    ['3. Workday GL Outbound','GL ops',            'Wrap JEs into DIU batch and post',              'Posted · batch ID'],
    ['4. Workday Cash Inbound','GL ops',           'Pull actual cash settlements after close',      'Loaded · N actuals'],
    ['5. Reconciliation + Feedback','Accounting + deal team','Compare, flag breaks, route to PortF','Reconciled · N breaks'],
]
story.append(data_table(
    ['Stage', 'Owner', 'Purpose', 'UI status chip'],
    pipeline_rows,
    col_widths=[40*mm, 30*mm, 70*mm, 30*mm]))

story.append(Spacer(1, 8))
story.append(Paragraph('Five most-used calculations', H2))
story.append(formula_box(
    'Effective Interest Rate (EIR) — IFRS 9 §B5.4',
    'Solve r so that  Σ CFᵢ / (1+r)^tᵢ  =  Net carrying value at recognition',
    where_html='CFᵢ = contractual cashflows (drawdowns, repayments, EIR-included fees). t in years. '
               'For RFR deals: EIR ≈ base rate + margin (e.g. SONIA 4.75% + 4.50% = 9.25%).'))
story.append(Spacer(1, 4))
story.append(formula_box(
    'Daily interest accrual',
    'Daily interest  =  Balance × (Coupon rate) × DayCountFactor(basis, date)',
    where_html='DayCountFactor returns 1/360, 1/365, or 1/daysInYear(date) for ACT/ACT.'))
story.append(Spacer(1, 4))
story.append(formula_box(
    '12-month ECL (Stage 1) — IFRS 9 §5.5.5',
    'ECL₁₂  =  PD₁₂ × LGD × EAD',
    where_html='PD₁₂ = 12-month probability of default. LGD = loss given default (40% typical). '
               'EAD = exposure at default (drawn balance + CCF × undrawn).',
    posts_html='DR 470000 Impairment Expense  /  CR 145000 Loan Loss Allowance'))
story.append(Spacer(1, 4))
story.append(formula_box(
    'Lifetime ECL (Stage 2 / 3) — IFRS 9 §5.5.3',
    'ECLₗ  =  Σ_{t=1..T}  PDₜ × LGD × EADₜ × DF_t',
    where_html='Sum across the lifetime of the exposure. DF_t = discount factor using original EIR.'))
story.append(Spacer(1, 4))
story.append(formula_box(
    'Carrying value (IAS 1 §54)',
    'Closing carrying  =  Opening carrying + Drawdowns − Repayments + EIR accretion\n'
    '                  + PIK capitalised ± Modification G/L ± Hedge P&amp;L ± FX',
    where_html='ECL is presented as a memo contra-asset below carrying value, not as a movement.'))

story.append(Spacer(1, 8))
story.append(Paragraph('Most-referenced GL accounts (Investran chart)', H2))
gl_rows = [
    ['111000', 'Cash',                          'DR/CR',  'Money in / out'],
    ['113000', 'Interest / fee receivable',     'DR',     'Accrued but not received'],
    ['141000', 'Investments at Cost',           'DR',     'Loan asset (amortised cost)'],
    ['142000', 'Investments at Fair Market Value','DR',   'FVTPL / FVOCI assets'],
    ['145000', 'Loan Loss Allowance',           'CR',     'Contra-asset (ECL)'],
    ['421000', 'Interest Income',               'CR',     'Daily accrued interest'],
    ['442000', 'Modification Gain / Loss',      'CR/DR',  'IFRS 9 §5.4.3 modification'],
    ['450000', 'Unrealised Gain / Loss',        'CR/DR',  'FVTPL MTM'],
    ['451000', 'Hedge Ineffectiveness P&amp;L',     'CR/DR',  'IFRS 9 §6'],
    ['452000', 'Fair Value Hedge MTM',          'CR/DR',  'IFRS 9 §6 FV hedge'],
    ['470000', 'Impairment Expense',            'DR',     'IFRS 9 §5.5 ECL build'],
    ['492100', 'Arrangement Fee Income',        'CR',     'IFRS 15 point-in-time / EIR'],
    ['492200', 'Commitment Fee Income',         'CR',     'IFRS 15 over-time'],
    ['492300', 'Guarantee Fee Income',          'CR',     'IFRS 15 over-time'],
    ['360000', 'Cash Flow Hedge Reserve (OCI)', 'CR/DR',  'Effective CFH portion'],
]
story.append(data_table(
    ['Account', 'GL Name', 'Side', 'Used for'],
    gl_rows,
    col_widths=[20*mm, 60*mm, 18*mm, 72*mm]))

story.append(PageBreak())

# ━━━ PART 2 — HOW THE APPLICATION WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(2, 'How the Application Works',
               'The system map, the five stages end-to-end, and a 90-second quick start '
               'that takes a deal from PortF JSON all the way to a posted Workday batch with '
               'a reconciliation feedback file ready to ship.', story)

story.append(Paragraph('What this module does', H2))
story.append(Paragraph(
    'The Loan Module Integration Layer is a thin orchestration layer that sits between four '
    'real systems in the NWF consortium. Each system continues to do what it was built for. '
    'The integration layer\'s job is to translate, balance, post, reconcile, and feed back.',
    BODY))

story.append(Paragraph('Architecture', H3))
arch_rows = [
    ['PortF',              'System of Record',    'Deal capture, cashflows, ratchets, drawdowns, workflows'],
    ['PCS / Investran',    'Accounting engine',   'IFRS 9 / 13 / 15 treatment, balanced double-entry journals'],
    ['Workday',            'General Ledger',      'Receives DIU batches, posts, returns actual cash'],
    ['Loan Module Layer',  'This application',    'Translates, balances, pushes, pulls, reconciles, feeds back'],
]
story.append(data_table(
    ['System', 'Role', 'What it owns'],
    arch_rows, col_widths=[40*mm, 40*mm, 90*mm]))

story.append(Paragraph('The five stages in order', H2))
stages_rows = [
    ['1', 'PortF Inbound',       'Loads PortF JSON or Excel. Parses 2,000+ day accrual schedules. '
                                  'Per-row Excel merge fills missing rate / interest / fee / PIK from the engine.'],
    ['2', 'PCS / Investran',     'Classifies under IFRS 9 §5.1 (AmortisedCost / FVOCI / FVTPL). '
                                  'Computes EIR, fees (IFRS 15), ECL (§5.5), modification (§5.4.3), hedge (§6). '
                                  'Emits balanced JEs against the Investran chart.'],
    ['3', 'Workday GL Outbound', 'Wraps JEs in a DIU batch envelope with a deterministic external key. '
                                  'DR/CR balance check before issuing batch ID. Idempotent retries.'],
    ['4', 'Workday Cash Inbound','Receives actual cash settlements with workdayJournalId + status. '
                                  'Synthetic sample injects deliberate breaks for the demo.'],
    ['5', 'Reconciliation',      'Matches PCS expected vs Workday actual per effective date + transaction type. '
                                  'Three buckets: tied / within tolerance / break. Feedback payload to PortF.'],
]
story.append(data_table(
    ['#', 'Stage', 'What happens'],
    stages_rows, col_widths=[10*mm, 35*mm, 125*mm]))

story.append(Paragraph('90-second quick start', H2))
story.append(Paragraph(
    'Open <font face="Courier">loan-module-integration-layer.html</font> in a browser (no '
    'server needed for the pipeline itself; the chat assistant needs the proxy — see Part 9).',
    BODY))
qs_rows = [
    ['1', 'Pick Libra 2 from the Active Deal dropdown'],
    ['2', 'Stage 1 → Use Active Deal as Sample (2,559-row schedule loads)'],
    ['3', 'Stage 2 → Run Accounting (18 JE rows, KPIs, Evidence Pack)'],
    ['4', 'Stage 3 → Push DIU to Workday (balanced £39.41m DR/CR)'],
    ['5', 'Stage 4 → Synthesise Sample with Variances (5 cash actuals, 2 breaks)'],
    ['6', 'Stage 5 → Run Reconciliation → Send Feedback to PortF'],
]
story.append(data_table(['#', 'Action'], qs_rows, col_widths=[12*mm, 158*mm]))
story.append(Spacer(1, 6))
story.append(callout('Tip',
    'Refresh and pick <b>Libra 3</b> to see hedge-accounting JEs (CFH on OCI account 360000) appear '
    'in the journal table. Pick <b>Volt</b> to see guarantee accounting where total loan interest = £0 '
    'because NWF is the guarantor, not the lender — only the guarantee fee (£26.48m) is income.'))

story.append(PageBreak())

# ━━━ PART 3 — CALCULATIONS REFERENCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(3, 'Calculations Reference',
               'Every formula the engine uses, what it expects as input, what it produces, '
               'and which GL accounts the result posts to. Use this section like a cookbook.',
               story)

# ── 3.1 Day-count conventions ──────────────────────────────────────────────
story.append(Paragraph('3.1  Day-count conventions', H2))
story.append(Paragraph(
    'The day-count basis on the instrument record controls the fraction of a year each '
    'calendar day represents for accrual purposes. The engine looks this up per row.',
    BODY))
story.append(data_table(
    ['Basis', 'Per-day factor', 'When used'],
    [['ACT/360', '1 / 360', 'USD, EUR floating loans (SOFR, EURIBOR)'],
     ['ACT/365', '1 / 365', 'GBP loans typically (SONIA + spread)'],
     ['ACT/ACT', '1 / daysInYear(date)', 'Government bonds, IFRS 9 EIR solve'],
     ['30/360',  '1 / 360', 'Legacy fixed-rate; simplified for daily granularity']],
    col_widths=[30*mm, 40*mm, 100*mm]))

# ── 3.2 Daily interest accrual ──────────────────────────────────────────────
story.append(Paragraph('3.2  Daily interest accrual', H2))
story.append(formula_box(
    'Daily interest',
    'dailyInterest  =  balance × currentRate × dayCountFactor(basis, date)',
    where_html='balance = drawn amount on that day. currentRate = coupon for the period (fixed, '
               'or RFR base + margin, including ratchet step-ups and ESG adjustments).',
    posts_html='DR 113000 Interest Receivable / CR 421000 Interest Income (daily); '
               'cleared to 111000 Cash on coupon date.'))
story.append(Spacer(1, 4))
story.append(callout('Worked example — Libra 2, day 800',
    'Balance £25,000,000 · currentRate = SONIA 4.7500% + 4.5000% margin = 9.2500% · basis ACT/365.<br/>'
    '<font face="Courier">dailyInterest = 25,000,000 × 0.0925 × (1/365) = £6,335.62</font>'))

# ── 3.3 RFR coupon construction ────────────────────────────────────────────
story.append(Paragraph('3.3  Floating-rate coupon (RFR + margin)', H2))
story.append(Paragraph(
    'For SONIA / SOFR / ESTR / EURIBOR / TONA / FED-driven deals, the engine reads the base '
    'rate from <font face="Courier">rfr.baseRate</font> and the margin (in bps) from '
    '<font face="Courier">marginSchedule[].marginBps</font>. Ratchets step the margin up/down '
    'at scheduled trigger dates; ESG adjustments are an additive override.', BODY))
story.append(formula_box(
    'RFR coupon',
    'currentRate  =  rfr.baseRate + marginSchedule[periodIdx].marginBps / 10000 + esgAdjustment',
    where_html='periodIdx selected by date. Compounded RFR uses a rolling lookback if '
               'rfr.compounding = true.'))

# ── 3.4 PIK accrual + capitalisation ───────────────────────────────────────
story.append(Paragraph('3.4  PIK accrual and capitalisation', H2))
story.append(formula_box(
    'Daily PIK',
    'dailyPik  =  balance × pikRate × dayCountFactor(basis, date)',
    where_html='Accrues every day on the drawn balance. Does not pay in cash.',
    posts_html='Capitalisation event: DR 141000 Investments at Cost / CR (clears PIK accrual). '
               'Caption: "Investment accretion - PIK interest".'))
story.append(Spacer(1, 4))
story.append(callout('Capitalisation gate',
    'PIK capitalises on the anchor day-of-month at the configured frequency '
    '(Monthly / Quarterly / Yearly). On capitalisation day, the cumulative accrued PIK is added to '
    'the balance and the accrual counter resets. The Treatment panel\'s PIK editor lets you override '
    'enabled / rate / frequency inline — engine re-runs immediately.'))

# ── 3.5 Effective Interest Rate ─────────────────────────────────────────────
story.append(Paragraph('3.5  Effective Interest Rate (EIR) — IFRS 9 §B5.4', H2))
story.append(formula_box(
    'EIR solve',
    'Solve r so that  Σ CFᵢ / (1+r)^tᵢ  =  Net carrying value at recognition',
    where_html='CFᵢ = contractual cashflows including drawdowns (−), repayments (+), and '
               'fees-included-in-EIR (arrangement fees with EIR treatment). t in years from '
               'settlement. Bisection over r ∈ [−0.99, 5.0], tolerance 1e-9.'))
story.append(Spacer(1, 4))
story.append(Paragraph('What the engine reports', H4))
story.append(data_table(
    ['Field', 'Meaning'],
    [['effectiveYield', 'Yield consumed by the effective-interest accrual family'],
     ['impliedYTM',     'Yield-to-maturity from purchase price + projected coupon CFs'],
     ['contractualYield','Headline coupon rate'],
     ['accretionPerDay','Per-day amortisation factor (effectiveYield / 365)']],
    col_widths=[40*mm, 130*mm]))
story.append(Spacer(1, 4))
story.append(callout('RFR &amp; multi-tranche shortcut',
    'For RFR deals the engine reports <font face="Courier">rfr.baseRate + margin</font> as a '
    'face-weighted aggregate rather than re-solving (the daily reset would make the solve '
    'meaningless). For multi-tranche structures (Suffolk Solar) and multi-underlying guarantees '
    '(Volt Multi-Loan) the engine recurses into children and returns a face-weighted aggregate.'))

# ── 3.6 Fee recognition (IFRS 15) ──────────────────────────────────────────
story.append(Paragraph('3.6  Fee recognition — IFRS 15', H2))
story.append(data_table(
    ['Fee type', 'Treatment', 'Account', 'Pattern'],
    [['Arrangement fee',    'EIR-included or point-in-time', '492100', 'Spread over life via EIR (preferred) or full at settlement'],
     ['Commitment fee',     'Over-time on undrawn',         '492200', 'Straight-line over commitment period'],
     ['Guarantee fee',      'Over-time',                    '492300', 'Straight-line over guarantee period'],
     ['Management fee',     'Over-time',                    '492400', 'Periodic'],
     ['Dividend equity',    'Point-in-time',                '492500', 'On ex-date'],
     ['Non-use fee',        'Over-time',                    '492200 (variant)', 'Charged on undrawn portion of revolver']],
    col_widths=[40*mm, 40*mm, 22*mm, 68*mm]))
story.append(Spacer(1, 4))
story.append(formula_box(
    'EIR-included fee',
    'fee_carrying_at_t  =  fee_total − Σ dailyEIRAccretion(s)  for s ≤ t',
    where_html='At t = 0, fee is held as contra-asset (negative carrying). Accreted into income '
               'daily via EIR; by t = maturity the contra balance is zero.',
    posts_html='Recognition: DR 113000 / CR 492100 (point-in-time); '
               'EIR pattern: DR (contra-asset) / CR 421000 daily.'))

# ── 3.7 ECL — IFRS 9 §5.5 ──────────────────────────────────────────────────
story.append(Paragraph('3.7  Expected Credit Loss (ECL) — IFRS 9 §5.5', H2))
story.append(Paragraph(
    'Three stages drive the measurement period. Stage assignment is driven by the '
    '<font face="Courier">ecLStage</font> field on the instrument, with auto-migration on DPD '
    'threshold breach and covenant breach (configurable in the Treatment panel).',
    BODY))
story.append(data_table(
    ['Stage', 'Trigger', 'Measurement', 'Interest base'],
    [['1', 'Performing — no SICR',                    '12-month ECL',   'Gross carrying'],
     ['2', 'SICR observed (DPD > 30, watchlist, etc.)','Lifetime ECL',   'Gross carrying'],
     ['3', 'Credit-impaired (default, DPD > 90)',     'Lifetime ECL',   'Net of allowance'],
     ['POCI','Purchased / Originated Credit-Impaired','Lifetime ECL',   'Credit-adjusted EIR on initial FV']],
    col_widths=[15*mm, 50*mm, 35*mm, 70*mm]))
story.append(Spacer(1, 6))
story.append(formula_box(
    'Stage 1 — 12-month ECL',
    'ECL₁₂  =  PD₁₂ × LGD × EAD',
    where_html='PD₁₂ from rating + macroeconomic overlay. EAD = drawn + CCF × undrawn.',
    posts_html='DR 470000 Impairment Expense / CR 145000 Loan Loss Allowance'))
story.append(Spacer(1, 4))
story.append(formula_box(
    'Stages 2 / 3 / POCI — Lifetime ECL',
    'ECLₗ  =  Σ_{t=1..T} PDₜ × LGD × EADₜ × DF_t,    DF_t = 1 / (1+EIR)^t',
    where_html='Discount factor uses original EIR (or credit-adjusted EIR for POCI per §5.4.1).'))
story.append(Spacer(1, 4))
story.append(callout('Auto-migration logic',
    '<b>DPD ≥ 30:</b> Stage 1 → Stage 2 (configurable threshold).&nbsp;&nbsp;'
    '<b>DPD ≥ 90:</b> Stage 2 → Stage 3.&nbsp;&nbsp;'
    '<b>Covenant breach + watchlist override:</b> forces Stage 2.&nbsp;&nbsp;'
    'The Treatment panel\'s DPD thresholds and Watchlist override controls let you re-test scenarios live.'))

# ── 3.8 Modification accounting — IFRS 9 §5.4.3 ────────────────────────────
story.append(Paragraph('3.8  Modification accounting — IFRS 9 §5.4.3', H2))
story.append(formula_box(
    'Substantial-modification test',
    '|PV_new(orig EIR) − Carrying_old| / Carrying_old  ≥  10%   ⇒  Substantial',
    where_html='PV_new = present value of modified cashflows discounted at the original EIR. '
               'Threshold is configurable (default 10%).',
    posts_html='Substantial → derecognise old asset, recognise new (re-derive EIR). '
               'Non-substantial → adjust carrying, post P&amp;L. Both post to 442000.'))
story.append(Spacer(1, 4))
story.append(Paragraph('Two paths', H4))
story.append(data_table(
    ['Path', 'Carrying treatment', 'EIR treatment', 'P&amp;L impact'],
    [['Substantial',     'Derecognise + recognise new', 'Re-derived from mod date',  'Gain/loss = FV_new − Carrying_old'],
     ['Non-substantial', 'Adjusted to PV_new',          'Original EIR retained',     'PV_new − Carrying_old']],
    col_widths=[35*mm, 50*mm, 45*mm, 40*mm]))

# ── 3.9 Carrying value waterfall ────────────────────────────────────────────
story.append(Paragraph('3.9  Carrying Value Waterfall — IAS 1 §54', H2))
story.append(formula_box(
    'Carrying value movement (gross of ECL)',
    'Closing_carrying  =  Opening_carrying\n'
    '                  + Drawdowns − Repayments\n'
    '                  + EIR Accretion + OID Amortisation\n'
    '                  + PIK Capitalised\n'
    '                  ± Modification gain/loss\n'
    '                  ± Hedge P&amp;L\n'
    '                  ± FX Revaluation',
    where_html='Opening carrying = principal balance − deferred fees at recognition. '
               'ECL is shown as a memo block below the waterfall (gross → less ECL → net), not as a movement.'))
story.append(Spacer(1, 4))
story.append(callout('Why ECL is a memo, not a movement',
    'IFRS 9 §5.5 requires the impairment allowance to be presented as a separate contra-asset. '
    'The carrying value waterfall ties to gross carrying; the ECL allowance is disclosed in the '
    'memo block underneath as <i>gross → less ECL → net</i>. This is what auditors expect to see.'))

# ── 3.10 Fair value sensitivities ──────────────────────────────────────────
story.append(Paragraph('3.10  Fair Value Sensitivities — IFRS 13 §93', H2))
story.append(Paragraph(
    'The sensitivity set displayed depends on the FV Level chosen in the Treatment panel. '
    'For amortised-cost holdings the panel still shows disclosure-only sensitivities because '
    'IFRS 7 §25 requires them in the notes.', BODY))
story.append(data_table(
    ['Level', 'Sensitivities shown', 'Inputs disclosure'],
    [['L1 quoted price', '±10% / ±25% market price shocks', 'Price source, bid-ask, market depth'],
     ['L2 observable',   '±50 / ±100 bps rate shifts + ±50 bps spread', 'Reference curve, peer spread, FX'],
     ['L3 unobservable', '±150 bps rate, ±100 bps spread, ±200 bps illiquidity, ±5% recovery',
                         'Significant unobservable inputs per §93(d): discount rate, PD, LGD, illiquidity premium']],
    col_widths=[30*mm, 70*mm, 70*mm]))
story.append(Spacer(1, 4))
story.append(formula_box(
    'Modified-duration approximation',
    'ΔFV  ≈  − ModDuration × Δyield × Carrying',
    where_html='ModDuration ≈ life × 0.6 (heuristic for bullet-style loans). For Level 3 production '
               'use, replace with full DCF + Monte Carlo over the unobservable inputs.'))

# ── 3.11 FX revaluation ─────────────────────────────────────────────────────
story.append(Paragraph('3.11  FX revaluation', H2))
story.append(formula_box(
    'Daily FX gain/loss (foreign-currency loan)',
    'dailyFXGain  =  balanceFC × (fxRate_t − fxRate_{t-1})',
    where_html='balanceFC = balance in foreign currency. fxRate = reporting currency per FC unit. '
               'Cadence configurable: Daily / Period-end / On-event.',
    posts_html='DR/CR 450000 Unrealised Gain/Loss; CR/DR 141000 carrying'))

# ── 3.12 Hedge accounting ───────────────────────────────────────────────────
story.append(Paragraph('3.12  Hedge accounting — IFRS 9 §6', H2))
story.append(Paragraph(
    'Only kicks in if the instrument has a <font face="Courier">hedge</font> block. CFH splits MTM '
    'into effective (OCI reserve 360000) and ineffective (P&amp;L 451000). FV hedge MTM all flows '
    'through 452000.', BODY))
story.append(formula_box(
    'Effectiveness split (CFH)',
    'Effective_OCI  =  min(|ΔFV_hedge|, |ΔFV_hedged|) × sign(ΔFV_hedge)\n'
    'Ineffective_PL =  ΔFV_hedge − Effective_OCI',
    posts_html='Effective: DR/CR 360000 OCI reserve. Ineffective: DR/CR 451000 P&amp;L. '
               'Reclass to P&amp;L when the hedged forecast cashflow occurs.'))

# ── 3.13 Period-on-Period variance ─────────────────────────────────────────
story.append(Paragraph('3.13  Period-on-Period (PoP) variance decomposition', H2))
story.append(formula_box(
    'PoP variance walk (split into named effects)',
    'Rate effect       =  (rate_B − rate_A) × bal_A × days_A / 365\n'
    'Balance effect    =  rate_A × (bal_B − bal_A) × days_A / 365\n'
    'Day-count effect  =  rate_A × bal_A × (days_B − days_A) / 365\n'
    'Modification effect = Σ daily mod_gain in B − Σ in A\n'
    'Residual          =  ΔInterest_total − (Rate + Balance + Day-count + Mod)',
    where_html='Subscript A = first half of schedule, B = second half. Residual captures cross-effects '
               'and any unmodelled drivers.'))

# ── 3.14 Reconciliation tolerance ──────────────────────────────────────────
story.append(Paragraph('3.14  Reconciliation tolerance', H2))
story.append(data_table(
    ['Bucket', 'Criterion', 'Action'],
    [['tied',   '|Δ| ≤ £1 (absolute tolerance)',          'Pass'],
     ['within', '|Δ| / pcsExpected ≤ 0.5% (relative)',    'Pass with note'],
     ['break',  '|Δ| > 0.5% OR row missing OR CANCELLED', 'Flag, feedback to PortF']],
    col_widths=[25*mm, 80*mm, 65*mm]))
story.append(Spacer(1, 4))
story.append(callout('Tolerance config',
    'Tolerances live in <font face="Courier">RECON_TOLERANCES</font> in the engine. The absolute '
    'tolerance handles rounding noise; the relative tolerance handles minor cashflow timing differences '
    'within a settlement window. Anything bigger is a real exception that the deal team should investigate.'))

story.append(PageBreak())

# ━━━ PART 4 — FUNCTIONALITY REFERENCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(4, 'Functionality Reference',
               'Every button, every panel, every download — by stage. Use this section when you '
               'need to know what a control does without poking around the UI.', story)

# ── 4.1 Stage 1 ────────────────────────────────────────────────────────────
story.append(Paragraph('4.1  Stage 1 — PortF Inbound', H2))
story.append(Paragraph('Buttons', H3))
story.append(data_table(
    ['Button', 'What it does', 'When to use'],
    [['Load JSON from PortF',  'Paste / upload a PortF cashflow JSON payload',           'Production path — PortF exports JSON via REST/file drop'],
     ['Load Excel from PortF', 'Parse the canonical PortF cashflow Excel workbook',     'Operator path — deal team hands over Excel'],
     ['Sample Excel',          'Download a blank Excel template with the expected layout','Hand to a deal team that has never produced one'],
     ['Use Active Deal as Sample','Generate a synthetic PortF JSON from a seed instrument','Demo / testing — no external data needed']],
    col_widths=[40*mm, 70*mm, 60*mm]))

story.append(Paragraph('Excel merge behaviour', H3))
story.append(Paragraph(
    'The canonical PortF Excel template carries Date, Initial Purchase, Drawdown, Principal '
    'Payment, Day Count, Amount (Balance). It does <b>not</b> carry rate / interest / fee / PIK '
    'columns. On import, the parser writes those rows and then merges in the engine\'s daily '
    'values per row — only filling missing-or-zero fields, never overwriting any explicit Excel '
    'values. When PortF starts populating richer columns in future, those values take precedence '
    'and the merge becomes a no-op.', BODY))

story.append(Paragraph('What you see after loading', H3))
story.append(data_table(
    ['Field', 'Source', 'Example (Libra 2)'],
    [['Deal identity',      'instrument.deal',     'Libra 2 / NWF Sustainable Infrastructure / NWF 100% Bilateral Position'],
     ['Term',               'settlementDate → maturityDate', '2024-10-08 → 2031-10-10 (2,559 days)'],
     ['Notional',           'faceValue / commitment','£25,000,000 / £25,000,000'],
     ['IFRS context',       'instrument.ifrs',     'AmortisedCost · SPPI passed · HoldToCollect · ECL Stage 1'],
     ['Schedule preview',   'accrualSchedule[0..7]','Day 1: Arrangement Fee £437,500. Day 2+: daily interest accrual.']],
    col_widths=[35*mm, 55*mm, 80*mm]))

# ── 4.2 Stage 2 ────────────────────────────────────────────────────────────
story.append(Paragraph('4.2  Stage 2 — PCS / Investran (the IFRS-aligned engine)', H2))
story.append(Paragraph('IFRS treatment order', H3))
story.append(Paragraph(
    'When you click <b>Run Accounting</b>, the engine runs in this order: (1) IFRS 9 §5.1 '
    'classification, (2) IFRS 9 §B5.4 EIR, (3) IFRS 13 fair value level, (4) IFRS 15 fee revenue, '
    '(5) IFRS 9 §5.5 ECL, (6) IFRS 9 §5.4.3 modification, (7) IFRS 9 §6 hedge accounting (only if '
    'a hedge block is present on the instrument).', BODY))

story.append(Paragraph('Treatment panel — 24 controls in 5 sections', H3))
story.append(data_table(
    ['Section', 'Controls', 'Effect'],
    [['A. Core Classification', 'IFRS 9 class, SPPI, business model, FV Level, ECL stage',
                                'Drives the whole treatment chain'],
     ['B. Credit Risk &amp; ECL',   'POCI, Stage 3 interest base, suspended interest, EAD CCF, DPD thresholds, watchlist, macro overlay, PD/LGD',
                                'Tunes ECL measurement + auto-migration'],
     ['C. Modification policy', 'Substantial threshold, re-compute EIR on substantial, default treatment, continuing involvement',
                                'Controls IFRS 9 §5.4.3 behaviour'],
     ['C-bis. Modification events', 'Inline editor (date / type / gain-loss / reason) + sample injectors',
                                'Live-test substantial / non-substantial scenarios'],
     ['C-tris. PIK editor',     'Enabled, rate, capitalisation frequency',
                                'Override contractual PIK on the active deal'],
     ['D. Tax &amp; Other',         'WHT rate, WHT recoverability, deferred tax tracking, FX cadence',
                                'Period-end adjustments'],
     ['E. Per-fee IFRS 15',     'Over-time / point-in-time / EIR-included per fee',
                                'Routes each fee\'s recognition pattern']],
    col_widths=[40*mm, 70*mm, 60*mm]))
story.append(Spacer(1, 4))
story.append(callout('Behaviour after a change',
    'Every Treatment control change auto-runs the engine when PortF data is loaded: '
    '<b>(1)</b> M.schedule = buildSchedule(inst), <b>(2)</b> M.summary = summarize(...), '
    '<b>(3)</b> M.acctJournals = generateDIU(...), <b>(4)</b> Daily Schedule view, KPIs, capability grid, '
    'journal table, and Evidence Pack all re-render, <b>(5)</b> Stages 3–5 are invalidated. '
    '<b>Reset to defaults</b> reverts every control + injected modification events + PIK overrides.'))

story.append(Paragraph('The KPIs strip', H3))
story.append(data_table(
    ['KPI', 'Source', 'Notes'],
    [['Total Interest (life)',  'Σ dailyInterest',  '£0 on guarantees (correct — NWF is guarantor, not lender)'],
     ['Total Fees (life)',      'Σ dailyFees',      'Arrangement + commitment + guarantee + management'],
     ['Total PIK (life)',       'Σ dailyPik',       'Accrued PIK over deal life'],
     ['EIR Accretion (life)',   'Σ dailyEIRAccretion','Includes upfront fee accretion'],
     ['JE rows',                'acctJournals.length','18 for Libra 2 over 7-year window']],
    col_widths=[40*mm, 50*mm, 80*mm]))

story.append(Paragraph('Daily Schedule view', H3))
story.append(Paragraph(
    'A collapsible panel between the journal table and Evidence Pack surfaces the engine\'s '
    'per-day output. Re-renders on every Run Accounting. Header strip shows row count, filter '
    '(Material events only / All days / Month-end days only), Download Full CSV, Download JSON.', BODY))
story.append(Paragraph('The 47-column CSV export includes:', BODY))
story.append(callout('CSV columns',
    '<font face="Courier" size="8">date, balance, drawnBalance, carryingValue, draw, paydown, '
    'couponRate, floatingRate, currentRate, dailyCash, cumInterestAccrued, cumInterestEarned, '
    'capitalized, interestAdjustments, cashInterestPayment, pikRate, dailyPik, cumPikAccrued, '
    'cumPikEarned, pikInterestAdjustments, pikPaydown, amortDaily, cumAmort, nonUseFee, '
    'cumNonUseFee, dailyFees, dailyEIRAccretion, cumEIRAccretion, dailyDefaultInterest, '
    'dailyDefaultFee, cumDefaultInterest, cumDefaultFee, dailyECLChange, eclAllowance, '
    'cumECLChange, dailyModGain, modEventDescription, cumModGain, fxRate, dailyFXGain, '
    'cumFXGain, balanceFC, dailyHedgeOCI, dailyHedgePL, dailyHedgeReclass, '
    'cashFlowHedgeReserve, cumHedgeOCI, cumHedgePL, cumHedgeReclass, hedgeEffectiveness, '
    'hasEvent</font>'))

# ── 4.3 Stage 3 ────────────────────────────────────────────────────────────
story.append(Paragraph('4.3  Stage 3 — Workday GL Outbound', H2))
story.append(Paragraph('The DIU envelope', H3))
story.append(data_table(
    ['Field', 'Example'],
    [['templateId',     'b1e8d7c4-3f5a-4c62-8d9e-7a6b5c4d3e2f (GL_JOURNAL_V1)'],
     ['templateName',   'GL_JOURNAL_V1'],
     ['externalKey',    'lmil-libra2-2024-10-08-to-2031-10-10-9b3f2a1c'],
     ['batchId',        'WD-20260507-LIBRA2-4729'],
     ['batchType',      'STANDARD'],
     ['batchComments',  'LMIL · Libra 2 · NWF 100% Bilateral · 2024-10-08-to-2031-10-10'],
     ['generatedAt',    '2026-05-07T16:00:42Z'],
     ['sourceModule',   'Loan Module Integration Layer']],
    col_widths=[40*mm, 130*mm]))
story.append(Spacer(1, 4))
story.append(formula_box(
    'Deterministic externalKey',
    'externalKey  =  "lmil-{instrumentId}-{period}-{rowsHash}"\n'
    'rowsHash  =  djb2(rows.map(r => r.effectiveDate|r.transactionType|r.amountLE|r.account).join())',
    where_html='Two identical batches produce the same key. Workday treats matching external keys '
               'as idempotent — re-posting is a no-op rather than a duplicate.'))
story.append(Paragraph('The balance check', H3))
story.append(Paragraph(
    'Before issuing a batch ID, the layer sums DR vs CR across all rows. If they balance to within '
    '£0.01 the batch is accepted; otherwise the chip turns red ("UNBALANCED") and the batch is '
    'rejected. The engine generates balanced JEs by construction, so an unbalanced batch indicates '
    'a corruption that should never reach Workday.', BODY))
story.append(Paragraph('CSV sanitisation', H3))
story.append(Paragraph(
    'Applies to DIU CSV and the Daily Schedule CSV: en-dash / em-dash / middle-dot → hyphen, '
    'section symbol stripped, curly quotes → straight, ellipsis → "...", non-breaking spaces → spaces, '
    'currency symbols → 3-letter codes (£ → GBP, € → EUR, ¥ → JPY), money fields rounded to 2 dp, '
    'UTF-8 BOM prepended so Windows Excel opens the file with the correct encoding.', BODY))

# ── 4.4 Stage 4 ────────────────────────────────────────────────────────────
story.append(Paragraph('4.4  Stage 4 — Workday Cash Inbound', H2))
story.append(Paragraph(
    'Receives actual cash settlements with <font face="Courier">workdayJournalId</font> + status '
    '(POSTED / CANCELLED / FAILED). CANCELLED and FAILED rows are flagged as breaks regardless of '
    'amount.', BODY))
story.append(Paragraph('Two ways to load', H3))
story.append(data_table(
    ['Button', 'What it does'],
    [['Load Actual Cash from Workday',           'Paste / upload a real Workday actuals JSON'],
     ['Synthesise Sample (with variances)',      'Build actuals from PCS journals with deliberate breaks (timing, amount, missing)']],
    col_widths=[60*mm, 110*mm]))

# ── 4.5 Stage 5 ────────────────────────────────────────────────────────────
story.append(Paragraph('4.5  Stage 5 — Reconciliation + PortF Feedback', H2))
story.append(Paragraph(
    'For each PCS expected cash line, the layer searches for a matching Workday actual on the '
    'same effective date and transaction type. Result lands in tied / within / break (see §3.14). '
    'Click <b>Send Feedback to PortF</b> to download the JSON payload ready to POST to PortF\'s '
    '<font face="Courier">/api/integration/feedback</font> endpoint.', BODY))
story.append(Paragraph('Feedback payload fields', H3))
story.append(data_table(
    ['Field', 'Type', 'Meaning'],
    [['feedbackType',          'enum',     'RECONCILIATION_BREAKS / RECONCILIATION_CLEAN'],
     ['workdayBatchRef',       'object',   'batchId, externalKey, jeRows'],
     ['summary',               'object',   'cashLinesCompared, tied, withinTolerance, breaks, tieRatePct, netVarianceLE, totalAbsoluteVarianceLE'],
     ['breaks[]',              'array',    'date, transactionType, account, pcsExpected, workdayActual, varianceLE, variancePct, reason, workdayJournalId, action'],
     ['actionRequired',        'boolean',  'True if breaks > 0'],
     ['requestedActions[]',    'array',    'Standard remediation guidance for the deal team']],
    col_widths=[40*mm, 22*mm, 108*mm]))

story.append(PageBreak())

# ━━━ PART 5 — EVIDENCE PACK PANELS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(5, 'Accounting Evidence Pack',
               'Six collapsible panels below the journal table cover the NWF accounting agenda '
               'end-to-end. Each panel ties back to a specific IFRS clause or audit ask.', story)

ep_rows = [
    ['A', 'Month-End Close + Run Metadata',
        'Run identifier, version, effective date, run timestamp, user, current period dates, '
        'Draft → Reviewed → Approved → Posted workflow chip. When Posted, the panel locks into a '
        'green-banner state with Unlock Period and Start New Versioned Run buttons.'],
    ['B', 'Carrying Value Waterfall (IAS 1 §54)',
        'Anchors on opening carrying value (not principal). Itemises deferred IFRS 15 fees at '
        'recognition, drawdowns, repayments, EIR accretion, OID amortisation, PIK capitalised, '
        'modification G/L, hedge P&amp;L, FX. ECL is a memo block below (gross → less ECL → net).'],
    ['C', 'Period-on-Period Variance Walk',
        'Decomposes ΔInterest between two halves of the schedule into Rate × Balance × Days × '
        'Modification × Cross/mix residual. See §3.13 for the formulas.'],
    ['D', 'Fair Value Sensitivities (IFRS 13 §93)',
        'Branches by FV Level (1 / 2 / 3). Shows shock magnitudes and the disclosure inputs '
        'required. Modified-duration approximation; production-grade Level 3 would replace with '
        'full DCF + Monte Carlo.'],
    ['E', 'IFRS 9 ECL Journal Templates',
        'Six template entries for initial Stage 1 recognition, Stage 1→2, Stage 2→3, Stage 3→2 '
        'cure, default / write-off, post-write-off recovery. Templates carry illustrative amounts; '
        'engine substitutes period-specific ECL movements when posting.'],
    ['F', 'Modification History + Audit Run History',
        'Before/after EIR table, modification events log, run history (last 10 runs with run ID, '
        'version, when, user, status, JE row count, default-vs-override flag). Current run '
        'highlighted in light blue.'],
    ['G', 'ECL Calculation Trace',
        'Explicit IFRS 9 §5.5.17 formula trace: PD₁₂ × LGD × EAD = ECL₁₂, with the actual values '
        'used and the stage assignment narrative. Auditors love this panel.'],
]
story.append(data_table(['Panel', 'Title', 'What it shows'],
                        ep_rows, col_widths=[15*mm, 50*mm, 105*mm]))

story.append(PageBreak())

# ━━━ PART 6 — WORKED EXAMPLES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(6, 'Worked Examples',
               'Three deals end-to-end: a vanilla bilateral term loan (Libra 2), a hedged '
               'version of the same deal (Libra 3), and a financial guarantee (Volt) — to show '
               'the engine\'s behaviour when accounting answers diverge from intuition.', story)

# Example 1 — Libra 2
story.append(Paragraph('6.1  Libra 2 — vanilla bilateral term loan', H2))
story.append(Paragraph('Deal facts', H3))
story.append(data_table(
    ['Attribute', 'Value'],
    [['Instrument ID',     'libra2'],
     ['Legal entity',      'NWF Sustainable Infrastructure'],
     ['Position',          'NWF 100% Bilateral Position · Libra 2'],
     ['Income security',   'HSBC Facility B4 — Libra 2 (Compounded SONIA + 250bps)'],
     ['Currency',          'GBP'],
     ['Face / commitment', '£25,000,000 / £25,000,000'],
     ['Term',              '2024-10-08 → 2031-10-10 (2,559 days)'],
     ['Coupon',            'Compounded SONIA + 250bps (ratcheted)'],
     ['IFRS 9',            'AmortisedCost · SPPI passed · HoldToCollect · ECL Stage 1'],
     ['Risk',              'PD 0.5% · LGD 40%']],
    col_widths=[45*mm, 125*mm]))
story.append(Spacer(1, 6))
story.append(Paragraph('18 journal rows produced', H3))
story.append(data_table(
    ['#', 'Effective', 'Transaction type', 'Account', 'DR/CR', 'Amount (GBP)'],
    [['1',  '2024-10-08', 'Loan Drawdown',                       '141000', 'DR', '25,000,000'],
     ['2',  '2024-10-08', 'Loan Drawdown — Cash',                '111000', 'CR', '25,000,000'],
     ['3',  '2031-10-10', 'Income - Daily Accrued Interest',     '421000', 'CR', '13,361,596'],
     ['4',  '2031-10-10', 'Interest Receivable',                 '113000', 'DR', '13,361,596'],
     ['5',  '2031-10-10', 'Interest Cash Receipt',               '111000', 'DR', '13,361,596'],
     ['6',  '2031-10-10', 'Interest Receivable Clear',           '113000', 'CR', '13,361,596'],
     ['7',  '2024-10-08', 'Arrangement Fee Receivable',          '113000', 'DR', '437,500'],
     ['8',  '2024-10-08', 'Arrangement Fee Income (IFRS 15)',    '492100', 'CR', '437,500'],
     ['9',  '2024-10-08', 'Arrangement Fee Cash Receipt',        '111000', 'DR', '437,500'],
     ['10', '2024-10-08', 'Arrangement Fee Receivable Clear',    '113000', 'CR', '437,500'],
     ['11', '2031-10-10', 'Commitment Fee Receivable',           '113000', 'DR', '568,401'],
     ['12', '2031-10-10', 'Commitment Fee Income (IFRS 15)',     '492200', 'CR', '568,401'],
     ['13', '2031-10-10', 'Commitment Fee Cash Receipt',         '111000', 'DR', '568,401'],
     ['14', '2031-10-10', 'Commitment Fee Receivable Clear',     '113000', 'CR', '568,401'],
     ['15', '2031-10-10', 'Loan Drawdown',                       '141000', 'DR', '0'],
     ['16', '2031-10-10', 'Loan Drawdown — Cash',                '111000', 'CR', '0'],
     ['17', '2031-10-10', 'Impairment Expense (ECL)',            '470000', 'DR', '42,500'],
     ['18', '2031-10-10', 'Loan Loss Allowance (Contra-Asset)',  '145000', 'CR', '42,500']],
    col_widths=[8*mm, 22*mm, 65*mm, 18*mm, 12*mm, 25*mm],
    align_cols=[5]))
story.append(Spacer(1, 4))
story.append(callout('Balance check',
    'Total DR = Total CR = £39,407,901. The balanced chip lights up green. '
    'The IFRS 9 §5.5 12-month ECL is £42,500 = £25,000,000 × 0.5% × 40% × scaling × stage-1 factor.'))
story.append(PageBreak())

# Example 2 — Libra 3 with hedge
story.append(Paragraph('6.2  Libra 3 — same deal, with Cash Flow Hedge', H2))
story.append(Paragraph(
    'Libra 3 is the same £25m bilateral, but a SONIA-receiver interest-rate swap is layered on as '
    'a Cash Flow Hedge. The hedge protects against rate falls below the budgeted 4.75% floor.', BODY))
story.append(data_table(
    ['Attribute', 'Libra 2 (no hedge)', 'Libra 3 (CFH)'],
    [['Classification',        'AmortisedCost',                  'AmortisedCost'],
     ['Hedge accounting',      '—',                              'IFRS 9 §6 Cash Flow Hedge'],
     ['Hedge instrument',      '—',                              'SONIA-receiver IRS (pay fixed)'],
     ['Hedged item',           '—',                              'Variable interest on £25m drawn'],
     ['Effective portion → ',  '—',                              'Account 360000 (OCI reserve)'],
     ['Ineffective portion →', '—',                              'Account 451000 (P&amp;L)'],
     ['Reclass to P&amp;L',        '—',                              'When hedged forecast cashflow occurs']],
    col_widths=[50*mm, 50*mm, 70*mm]))
story.append(Spacer(1, 4))
story.append(callout('Why the difference matters',
    'Libra 2 books interest at the actual floating rate; the P&amp;L moves with SONIA. Libra 3\'s '
    'hedge re-routes the effective portion of swap MTM to OCI, so the income statement sees the '
    'budgeted fixed rate of ~7.25% (4.75% swap-fixed + 250bps margin). Only the ineffective portion '
    'hits P&amp;L. The OCI reserve unwinds into P&amp;L period-by-period as the hedged interest is recognised.'))

# Example 3 — Volt guarantee
story.append(Paragraph('6.3  Volt — financial guarantee (NWF as guarantor)', H2))
story.append(data_table(
    ['Attribute', 'Value'],
    [['Instrument type',     'Financial guarantee'],
     ['NWF role',            'Guarantor (not lender)'],
     ['Underlying lender',   'Bank of America'],
     ['Underlying borrower', 'Volt Renewables PLC'],
     ['Notional',            '£800,000,000'],
     ['Guarantee fee',       '£26,481,481 over life (over-time IFRS 15)'],
     ['Total loan interest', '£0 (NWF doesn\'t earn loan interest — Bank of America does)'],
     ['IFRS 9 ECL',          'Provision = PD × LGD × EAD on the guaranteed exposure'],
     ['Deferred fee',        '£1,919,562 at signing (arrangement fee, EIR-treated)']],
    col_widths=[45*mm, 125*mm]))
story.append(Spacer(1, 4))
story.append(callout('Volt carrying value waterfall',
    '<font face="Courier" size="8">'
    'Opening principal balance              £0\n'
    '− Deferred fees at recognition         (£1,919,562)\n'
    '= Opening carrying value (gross)       (£1,919,562)\n'
    '+ Drawdowns                            £800,000,000\n'
    '− Repayments                           (£755,555,555)\n'
    '+ EIR Accretion (IFRS 9 §B5.4)         £1,920,438\n'
    '= Closing carrying value (gross)       £44,444,883'
    '</font>'))

story.append(PageBreak())

# ━━━ PART 7 — FINANCIAL STATEMENTS YOU CAN BUILD ━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(7, 'Financial Statements You Can Build',
               'The most useful statement set for private credit funds and the underlying loan '
               'assets. Tie each one back to the panel in this app that feeds it.', story)

story.append(Paragraph('Priority — what to lead with', H2))
story.append(data_table(
    ['#', 'Statement', 'Why it matters', 'Source in this app'],
    [['1', 'Schedule of Investments (loan tape)',
          'THE report for credit funds. Auditors + LPs both live here.',
          'PortF panel + Carrying Value Waterfall + ECL panel'],
     ['2', 'Statement of Financial Position',
          'Loans at amortised cost by stage, with ECL contra-asset.',
          'Carrying Value Waterfall + memo block'],
     ['3', 'Statement of P&amp;L with EIR / ECL split',
          'Proves IFRS 9 is being applied correctly. (a) Interest via EIR. (b) ECL movements. (c) FX + modification.',
          'KPIs strip + Daily Schedule + ECL panel'],
     ['4', 'ECL Roll-Forward (Stage 1 ↔ 2 ↔ 3)',
          'What audit will demand to test §5.5 application.',
          'ECL Templates panel + auto-migration logs'],
     ['5', 'Statement of Changes in Net Assets (LP-facing)',
          'NAV, capital activity, GP carry accrual.',
          'Aggregate across instruments (cross-deal)'],
     ['6', 'Financial Highlights (IRR / TVPI / DPI / RVPI)',
          'ILPA template land.',
          'Aggregate across instruments (cross-deal)']],
    col_widths=[8*mm, 50*mm, 65*mm, 47*mm]))

story.append(Paragraph('Disclosures auditors will ask for', H2))
story.append(data_table(
    ['Disclosure', 'Reference', 'Source in this app'],
    [['Credit risk exposure by stage + industry',  'IFRS 7 §35M',  'ECL panel + concentration'],
     ['Modification gain/loss table',              'IFRS 9 §5.4.3','Modification History panel'],
     ['Fair value hierarchy',                      'IFRS 13 §93',  'FV Sensitivities panel'],
     ['Maturity ladder',                           'IFRS 7 §39',   'Daily Schedule view'],
     ['Top-10 borrower concentration',             'IFRS 7 §34',   'Cross-instrument aggregation'],
     ['Significant unobservable inputs (L3)',      'IFRS 13 §93(d)','FV Sensitivities panel (Level 3 view)']],
    col_widths=[60*mm, 35*mm, 75*mm]))

story.append(PageBreak())

# ━━━ PART 8 — FAQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(8, 'FAQ',
               'The questions that come up every demo — and the answers the deal team, '
               'auditors, and ops people actually need.', story)

faq = [
    ('Q1.  What if PortF sends a deal with a different version mid-period?',
     'Every run is point-in-time. If a new PortF version arrives, the operator re-runs Stages 1–5; '
     'the externalKey changes (rows hash changes) so Workday treats it as a new batch. The old '
     'batch is left posted unless the operator explicitly reverses it.'),
    ('Q2.  Is the engine deterministic?',
     'Yes. Given identical PortF input and identical Treatment-panel settings, the engine produces '
     'byte-identical JE rows and an identical externalKey. This is what makes idempotent retries possible.'),
    ('Q3.  Why is Total Interest (life) £0 on Volt — is that wrong?',
     'No, that\'s correct. Volt is a financial guarantee — NWF is the guarantor, not the lender. The '
     'borrower pays loan interest to Bank of America, not to NWF. NWF\'s only income from this deal is '
     'the guarantee fee (£26.48m over life), recognised over time under IFRS 15. "Total Interest = £0" '
     'is the correct answer for any guarantee instrument.'),
    ('Q4.  Why does the EIR show 9.25% on Libra 2 when coupon.spread = 0 in the deal record?',
     'For SONIA / SOFR / RFR-driven deals, the spread is on marginSchedule[].marginBps and the base is '
     'on rfr.baseRate. computeEIR reads both: rfr.baseRate (4.75%) + margin (4.50%) = 9.25%. The EIR '
     'note line shows the breakdown. For multi-tranche structures the engine recurses and returns a '
     'face-weighted aggregate.'),
    ('Q5.  Why does the carrying value waterfall sometimes show an amber Δ?',
     'The waterfall sums Opening carrying + Drawdowns − Repayments + EIR + OID amort + PIK + '
     'Modification + Hedge P&amp;L + FX. ECL is a memo (contra-asset disclosure), not a movement. Amber '
     'appears when the calculated total differs from closingCarrying by more than £1 — typical '
     'residual on multi-thousand-day schedules is sub-£500 from accumulated rounding.'),
    ('Q6.  I changed PIK / a treatment field but the JEs and KPIs didn\'t update.',
     'Every Run Accounting click — and every auto-rerun triggered by changing a Treatment-panel '
     'control — now rebuilds M.schedule and M.summary from current instrument state before generating '
     'journals. Make sure you\'ve refreshed the page since the fix. If you still see stale numbers, '
     'check the browser console and confirm PortF data is loaded in Stage 1.'),
    ('Q7.  How are user permissions handled?',
     'The Month-End Close panel has a Draft → Reviewed → Approved → Posted workflow. In production, '
     'each step would be gated on a separate user with a different role (segregation of duties), and '
     'Stage 3 push to Workday would gate on Reviewed + Approved.'),
    ('Q8.  Can I push the same JEs to a different GL system (not Workday)?',
     'Yes. The DIU envelope is a generic ERP-batch shape. Replace the DIU CSV download path with a '
     'different posting mechanism; the journal data is the same. The INVESTRAN_GL mapping would need '
     'to be re-pointed at the target chart.'),
    ('Q9.  How do I add a new accounting policy?',
     'Add a control to the editable Treatment panel HTML, wire it into applyTreatmentFromForm() to '
     'write to inst.ifrs.<newField>, and update loan-module-engine.js so the engine reads <newField> '
     'in the relevant treatment block. The capability grid card in Stage 2 should surface whether the '
     'new policy is active for the loaded deal.'),
    ('Q10.  When deployed to a corporate server, the chat fails with CORS. Why?',
     'The serve.py proxy only runs locally. When the HTML is hosted on a corporate server (e.g. FIS '
     'Cloud), there\'s no Python proxy alongside, so the chat\'s call to api.anthropic.com gets blocked '
     'by browser CORS. Three fixes: (a) deploy a Cloudflare Worker proxy, (b) ask IT to add a '
     'reverse-proxy rule on the corporate server, or (c) keep the chat local-only via serve.py.'),
]
for q, a in faq:
    story.append(Paragraph(q, H3))
    story.append(Paragraph(a, BODY))

story.append(PageBreak())

# ━━━ PART 9 — RUNNING THE APP LOCALLY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(9, 'Running the App',
               'How to launch the application locally with the Loan Assistant chat enabled, '
               'and what changes when you deploy to a corporate server.', story)

story.append(Paragraph('9.1  Local — full functionality including chat', H2))
story.append(callout('macOS / Linux',
    '<font face="Courier" size="9">'
    'cd "/Users/&lt;you&gt;/Claude Cowork folder/Claude Income Calculator"<br/>'
    'python3 serve.py<br/>'
    '# then open http://localhost:8080/loan-module-integration-layer.html'
    '</font>', bg=CODE_BG, border=SLATE))
story.append(Spacer(1, 4))
story.append(callout('Windows',
    '<font face="Courier" size="9">'
    'cd "C:\\Users\\&lt;you&gt;\\Claude Cowork folder\\Claude Income Calculator"<br/>'
    'python serve.py<br/>'
    '# or:  py serve.py<br/>'
    '# then open http://localhost:8080/loan-module-integration-layer.html'
    '</font>', bg=CODE_BG, border=SLATE))
story.append(Spacer(1, 4))
story.append(Paragraph(
    '<b>What serve.py does.</b> Two endpoints in one process: static file server on '
    '<font face="Courier">/</font>, and a POST proxy on '
    '<font face="Courier">/api/anthropic</font> that forwards to '
    '<font face="Courier">https://api.anthropic.com/v1/messages</font> with the proper headers. '
    'This is the same-origin trick that bypasses the CORS preflight issue (Anthropic\'s API doesn\'t '
    'return Access-Control-Allow-Origin for browser preflights).', BODY))

story.append(Paragraph('9.2  Pipeline-only (no chat)', H2))
story.append(callout('Any OS',
    '<font face="Courier" size="9">'
    'cd "&lt;workspace folder&gt;"<br/>'
    'python3 -m http.server 8080<br/>'
    '# open http://localhost:8080/loan-module-integration-layer.html<br/>'
    '# chat will show a "proxy not running" message; pipeline works fully'
    '</font>', bg=CODE_BG, border=SLATE))

story.append(Paragraph('9.3  Corporate server deployment', H2))
story.append(Paragraph(
    'When you host the HTML on a corporate web server, the chat panel needs a proxy reachable from '
    'the browser. Three options in order of speed:', BODY))
story.append(data_table(
    ['Option', 'What it is', 'Pros', 'Cons'],
    [['A. Cloudflare Worker',  'Tiny serverless proxy on workers.dev',     '5 min to set up, free tier, zero infra',                'Lives outside corporate perimeter — security review may push back'],
     ['B. Reverse proxy rule', 'Ask IT to map /api/anthropic on the corp server', 'Cleanest from a security review angle',          'Depends on IT cycle; needs egress whitelist for api.anthropic.com'],
     ['C. Local-chat only',    'Run serve.py on your laptop for chat',      'Zero IT involvement',                                   'Chat only works on your machine — not visible to others on the hosted page']],
    col_widths=[35*mm, 50*mm, 45*mm, 40*mm]))

story.append(PageBreak())

# ━━━ PART 10 — GLOSSARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section_header(10, 'Glossary',
               'The acronyms and IFRS-clause shorthand this app uses, with one-line definitions.', story)

glossary = [
    ('PortF',         'The deal-management System of Record. Owns deal capture, cashflows, ratchets, drawdowns, workflows.'),
    ('PCS / Investran','Accounting engine. Translates PortF cashflows into IFRS-aligned journals against the Investran chart.'),
    ('Workday',       'The General Ledger. Receives DIU batches from PCS, posts them, returns actual cash settlements.'),
    ('DIU',           'Data Import Utility — FIS Investran\'s batch-import API for posting to Workday.'),
    ('externalKey',   'A deterministic hash that lets Workday treat re-posts of identical batches as idempotent.'),
    ('EIR',           'Effective Interest Rate. The yield that NPVs all contractual cashflows to zero.'),
    ('ECL',           'Expected Credit Loss. IFRS 9 impairment provision; Stages 1 (12-month) / 2 (lifetime) / 3 (credit-impaired).'),
    ('SICR',          'Significant Increase in Credit Risk. Triggers Stage 1 → Stage 2 migration.'),
    ('POCI',          'Purchased or Originated Credit-Impaired. Special IFRS 9 category with EIR computed on initial fair value.'),
    ('CFH / FVH',     'Cash Flow Hedge / Fair Value Hedge. IFRS 9 §6 designations.'),
    ('OCI',           'Other Comprehensive Income. The equity reserve where CFH effective gains/losses sit.'),
    ('CCF',           'Credit Conversion Factor. Used to derive EAD on undrawn commitments.'),
    ('DPD',           'Days Past Due. Used for Stage 2 / 3 migration thresholds.'),
    ('SPPI',          'Solely Payments of Principal and Interest. The IFRS 9 §4.1.2 cashflow test.'),
    ('NWF',           'National Wealth Fund. The user organisation.'),
    ('RFR',           'Risk-Free Rate. SONIA, SOFR, ESTR, EURIBOR, FED, TONA — read from rfr.baseRate.'),
    ('PIK',           'Payment in Kind. Interest that capitalises into the loan balance instead of paying cash.'),
    ('Modification event','A change to deal terms during life. Tracked in instrument.modificationEvents[].'),
    ('Per-row Excel merge','Stage 1 enrichment that fills missing rate / interest / fee / PIK fields from the engine.'),
    ('Carrying value waterfall (gross)','IAS 1 §54 movement reconciliation; ECL is a memo block, not a movement, per IFRS 9 §5.5.'),
    ('Daily Schedule',   '47-column engine output, one row per calendar day, with material-event filter and CSV/JSON export.'),
    ('Evidence Pack',    'Six (now seven) collapsible audit-trail panels beneath the Stage 2 journal table.'),
    ('Loan Assistant',   'Claude-API-powered chat in the right-hand panel. Answers IFRS, ECL, and app-usage questions.'),
]
glossary_rows = [[Paragraph(f'<b>{term}</b>', BODY_TIGHT), Paragraph(definition, BODY_TIGHT)]
                 for term, definition in glossary]
story.append(Table(glossary_rows, colWidths=[45*mm, 125*mm], style=TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 6),
    ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LINEBELOW', (0,0), (-1,-2), 0.3, RULE),
])))

story.append(Spacer(1, 20))
story.append(hrule(TEAL, 1, 0, 6))
story.append(Paragraph(
    f'<i>End of guide. Last updated {VERSION}. For questions or change requests, raise a ticket '
    f'against the integration layer module, or open the Loan Assistant chat in the application '
    f'itself.</i>', NOTE))

# ─── BUILD ───────────────────────────────────────────────────────────────────
def build():
    doc = GuideDoc(OUTPUT_FILE)
    doc.multiBuild(story)
    print(f'\n✓ Wrote {OUTPUT_FILE}\n')

if __name__ == '__main__':
    build()

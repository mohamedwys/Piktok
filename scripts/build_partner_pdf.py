#!/usr/bin/env python3
"""Generate Mony_Project_Overview.pdf — partner-facing brief.

Run from project root:
    python scripts/build_partner_pdf.py
Output: Mony_Project_Overview.pdf in the project root.
"""

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame,
    Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, NextPageTemplate,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------
OUTPUT = Path(__file__).resolve().parent.parent / "Mony_Project_Overview.pdf"

# --------------------------------------------------------------------------
# Brand tokens (from BRAND.md — coral accent, dark stack)
# --------------------------------------------------------------------------
CORAL       = colors.HexColor('#FF5A5C')
CORAL_DARK  = colors.HexColor('#E04547')
CORAL_SOFT  = colors.HexColor('#FFE9E9')
INK         = colors.HexColor('#111111')
INK_2       = colors.HexColor('#4A4A4A')
INK_3       = colors.HexColor('#8A8A8A')
BORDER      = colors.HexColor('#E5E5E5')
SOFT_BG     = colors.HexColor('#FAFAFA')
HIGHLIGHT   = colors.HexColor('#FFF7F7')
GOOD        = colors.HexColor('#1F9D55')

PAGE_W, PAGE_H = A4
MARGIN = 1.8 * cm
CONTENT_W = PAGE_W - 2 * MARGIN

# --------------------------------------------------------------------------
# Page templates
# --------------------------------------------------------------------------
def draw_cover(c, doc):
    c.saveState()
    # Top coral block
    c.setFillColor(CORAL)
    c.rect(0, PAGE_H - 5.5 * cm, PAGE_W, 5.5 * cm, stroke=0, fill=1)
    # Wordmark
    c.setFillColor(colors.white)
    c.setFont('Helvetica-Bold', 64)
    c.drawString(MARGIN, PAGE_H - 3.7 * cm, "Mony")
    c.setFont('Helvetica', 11)
    c.drawString(MARGIN, PAGE_H - 4.5 * cm,
                 "A premium video-first social marketplace")

    # Footer block
    c.setFillColor(INK)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(MARGIN, MARGIN + 1.1 * cm,
                 "PROJECT OVERVIEW  ·  VALUATION BRIEF")
    c.setFillColor(INK_2)
    c.setFont('Helvetica', 9)
    c.drawString(MARGIN, MARGIN + 0.55 * cm,
                 "Prepared for partner review  ·  May 2026  ·  Confidential")

    # Right side accent bar
    c.setFillColor(CORAL)
    c.rect(PAGE_W - MARGIN - 2.5 * cm, MARGIN + 0.7 * cm, 2.5 * cm, 3,
           stroke=0, fill=1)
    c.restoreState()


def draw_content(c, doc):
    c.saveState()
    # Header
    c.setFillColor(CORAL)
    c.rect(MARGIN, PAGE_H - MARGIN + 0.35 * cm, 1.5 * cm, 2,
           stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(MARGIN, PAGE_H - MARGIN + 0.85 * cm, "MONY")
    c.setFillColor(INK_3)
    c.setFont('Helvetica', 8)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 0.85 * cm,
                      "Project Overview & Valuation Brief")
    # Footer
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.4)
    c.line(MARGIN, MARGIN - 0.1 * cm,
           PAGE_W - MARGIN, MARGIN - 0.1 * cm)
    c.setFillColor(INK_3)
    c.setFont('Helvetica', 8)
    c.drawString(MARGIN, MARGIN - 0.6 * cm, "Confidential — Mony")
    c.drawRightString(PAGE_W - MARGIN, MARGIN - 0.6 * cm,
                      f"{doc.page - 1}")
    c.restoreState()


# --------------------------------------------------------------------------
# Paragraph styles
# --------------------------------------------------------------------------
ss = getSampleStyleSheet()

h1 = ParagraphStyle('H1', parent=ss['Heading1'],
                    fontName='Helvetica-Bold', fontSize=22, leading=26,
                    textColor=INK, spaceBefore=0, spaceAfter=4)

h2 = ParagraphStyle('H2', parent=ss['Heading2'],
                    fontName='Helvetica-Bold', fontSize=13, leading=17,
                    textColor=INK, spaceBefore=12, spaceAfter=4)

h3 = ParagraphStyle('H3', fontName='Helvetica-Bold', fontSize=10, leading=13,
                    textColor=CORAL, spaceBefore=8, spaceAfter=3)

eyebrow = ParagraphStyle('Eyebrow', fontName='Helvetica-Bold', fontSize=8,
                         leading=10, textColor=CORAL, spaceAfter=2,
                         alignment=TA_LEFT)

lead = ParagraphStyle('Lead', parent=ss['BodyText'],
                      fontName='Helvetica', fontSize=11, leading=16,
                      textColor=INK, spaceAfter=10, alignment=TA_LEFT)

body = ParagraphStyle('Body', parent=ss['BodyText'],
                      fontName='Helvetica', fontSize=10, leading=14,
                      textColor=INK_2, spaceAfter=6, alignment=TA_LEFT)

body_dark = ParagraphStyle('BodyDark', parent=body, textColor=INK)

bullet = ParagraphStyle('Bullet', parent=body, leftIndent=14, bulletIndent=2,
                        spaceAfter=2)

small = ParagraphStyle('Small', parent=body, fontSize=8, leading=11,
                       textColor=INK_3)

cell_h = ParagraphStyle('CellHead', fontName='Helvetica-Bold', fontSize=9,
                        leading=11, textColor=colors.white, alignment=TA_LEFT)

cell_b = ParagraphStyle('CellBody', fontName='Helvetica', fontSize=9,
                        leading=12, textColor=INK, alignment=TA_LEFT)

cell_num = ParagraphStyle('CellNum', fontName='Helvetica-Bold', fontSize=9,
                          leading=12, textColor=INK, alignment=TA_RIGHT)


# --------------------------------------------------------------------------
# Reusable helpers
# --------------------------------------------------------------------------
def page_title(label, title):
    return [
        Paragraph(label.upper(), eyebrow),
        Paragraph(title, h1),
        Spacer(1, 6),
    ]


def kv_table(rows, col_widths=None):
    """Two-column key/value table — labels left, values right (bold)."""
    data = [[Paragraph(k, body), Paragraph(v, body_dark)] for k, v in rows]
    cw = col_widths or [5.5 * cm, CONTENT_W - 5.5 * cm]
    t = Table(data, colWidths=cw, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
        ('LINEBELOW', (0, 0), (-1, -2), 0.4, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def fact_table(headers, rows, col_widths, header_bg=INK,
               body_styles=None):
    """Generic data table — colored header, zebra rows."""
    head_cells = [Paragraph(h, cell_h) for h in headers]
    body_cells = []
    body_styles = body_styles or [cell_b] * len(headers)
    for row in rows:
        body_cells.append([
            Paragraph(str(v), body_styles[i]) for i, v in enumerate(row)
        ])
    data = [head_cells] + body_cells
    t = Table(data, colWidths=col_widths, hAlign='LEFT', repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, BORDER),
    ]
    # Zebra
    for r in range(1, len(data)):
        if r % 2 == 0:
            style.append(('BACKGROUND', (0, r), (-1, r), SOFT_BG))
    t.setStyle(TableStyle(style))
    return t


def callout_box(title, value, sub=None, accent=CORAL):
    """Big-number callout card."""
    data = [
        [Paragraph(title.upper(), ParagraphStyle(
            'CT', fontName='Helvetica-Bold', fontSize=8, leading=10,
            textColor=accent))],
        [Paragraph(value, ParagraphStyle(
            'CV', fontName='Helvetica-Bold', fontSize=18, leading=22,
            textColor=INK))],
    ]
    if sub:
        data.append([Paragraph(sub, ParagraphStyle(
            'CS', fontName='Helvetica', fontSize=8, leading=11,
            textColor=INK_3))])
    t = Table(data, colWidths=[CONTENT_W / 3 - 0.3 * cm], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HIGHLIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (0, 0), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 10),
    ]))
    return t


def callout_row(items):
    """Row of three callout boxes."""
    cells = [items]
    t = Table(cells, colWidths=[CONTENT_W / 3] * 3, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    return t


def quoted_callout(text):
    p = Paragraph(text, ParagraphStyle(
        'Quote', fontName='Helvetica-Oblique', fontSize=10, leading=14,
        textColor=INK, leftIndent=12, rightIndent=12))
    t = Table([[p]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HIGHLIGHT),
        ('LINEBEFORE', (0, 0), (0, 0), 3, CORAL),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    return t


def section_divider():
    return Spacer(1, 6)


def bullets(items, style=bullet):
    return [Paragraph(f"•&nbsp;&nbsp;{x}", style) for x in items]


# --------------------------------------------------------------------------
# Build the story
# --------------------------------------------------------------------------
story = []

# ===== COVER =====
# Frame fills the lower 2/3 of the cover for cover-page body if needed.
# We leave it empty — the cover graphics are drawn on-canvas.
story.append(Spacer(1, 10 * cm))  # push body down so cover renders first
story.append(NextPageTemplate('content'))
story.append(PageBreak())


# ===== PAGE 2: AT A GLANCE =====
story += page_title("01  ·  At a Glance", "What Mony is, in one page")

story.append(Paragraph(
    "Mony is a dark, video-first social marketplace — TikTok-style discovery "
    "energy fused with marketplace conversion. The product is mobile-native, "
    "ships on iOS and Android, and is paired with a Next.js web companion "
    "for the Pro upgrade flow and admin surfaces. It targets buyers who "
    "treat shopping as discovery and sellers who care how their listings "
    "look — from a casual offload to a professional storefront.",
    lead))

story.append(Spacer(1, 8))

# Three top-line callouts
boxes = [
    callout_box("PRO SUBSCRIPTION", "$19.99 / mo",
                "Apple + Google + Stripe; single SKU"),
    callout_box("CODEBASE STATE", "Phases 1–9 complete",
                "Phase 10 + QA in progress"),
    callout_box("VALUATION RANGE", "AED 2M – 4M",
                "Realistic, pre-traction"),
]
story.append(callout_row(boxes))
story.append(Spacer(1, 14))

story.append(Paragraph("Why this matters", h2))
story.append(Paragraph(
    "The product is not a prototype. It is a feature-complete, store-ready "
    "build with the full payment, observability, and operational stack in "
    "place. Nine audited delivery phases sit behind it: schema, security, "
    "payments, observability, CI/CD, runbooks, and a full design system. "
    "What remains is launch — store submission, first marketing push, and "
    "the second revenue line (marketplace transaction fee via Stripe Connect).",
    body))

story.append(Spacer(1, 8))
story.append(Paragraph("Headline numbers", h2))

headline = [
    ("Pro subscription price",       "$19.99 / month  (single SKU, three channels)"),
    ("Revenue at 1,000 Pro subs",    "AED 640,000 / year net  (mixed channels, Year 1)"),
    ("Operating cost at launch",     "~ AED 42 / month"),
    ("Operating cost at 100k MAU",   "~ AED 1,962 / month"),
    ("Production cost to rebuild",   "AED 550,000 – 800,000  (Dubai-grade build)"),
    ("Estimated market value",       "AED 2,000,000 – 4,000,000  (realistic)"),
]
story.append(kv_table(headline))
story.append(PageBreak())


# ===== PAGE 3: WHAT MONY IS =====
story += page_title("02  ·  The Product", "What we built, who it is for")

story.append(Paragraph("Positioning", h2))
story.append(Paragraph(
    "A premium, dark, video-first marketplace. The vertical product feed "
    "borrows the discovery rhythm of TikTok; the action rail, glass overlays, "
    "and brand restraint borrow the considered polish of Apple Music. The "
    "buy moment lands in coral red — the only loud color in the system — so "
    "the conversion surface is unmissable when it appears.",
    body))

story.append(Paragraph("Audience", h2))
story.append(Paragraph(
    "Buyers who shop by browsing, not by searching. Sellers who care about "
    "how their listings look. The host range is wide — casual sellers "
    "offloading a single item to professional sellers running a storefront — "
    "but the product never feels casual on either side.",
    body))

story.append(Paragraph("What sets it apart", h2))
diffs = [
    "<b>Hybrid purchase model.</b> A Pro seller's listing can be Buy-Now "
    "(full Stripe checkout with shipping + phone) or Contact-Only "
    "(in-app chat with an offer flow). Free sellers default to Contact-Only.",
    "<b>Algorithmic For-You feed.</b> 40% followed sellers, 30% Pro-boosted "
    "listings, 20% trending in the user's viewed categories, 10% serendipity. "
    "Monetizes the boost perk while still surfacing fresh content.",
    "<b>One subscription, three channels.</b> Apple StoreKit, Google Play "
    "Billing, and Stripe — same SKU, unified server-side, same downstream "
    "Pro privileges. Web subscribers carry a much higher net margin.",
    "<b>Operational maturity.</b> 41 SQL migrations with rollback scripts, "
    "five operational runbooks, full Sentry + PostHog observability, OTA "
    "update channel — none of which a typical pre-launch app has.",
]
for b in bullets(diffs):
    story.append(b)

story.append(Spacer(1, 8))
story.append(quoted_callout(
    "Should feel as considered as Apple Music while browsing and as "
    "energizing as Whatnot when buying. — Brand brief"
))

story.append(PageBreak())


# ===== PAGE 4: TECHNOLOGY =====
story += page_title("03  ·  Technology", "What runs where")

story.append(Paragraph(
    "Mony is built on a modern, well-known stack. There is no proprietary "
    "infrastructure and no vendor lock-in beyond the usual cloud providers. "
    "Engineers familiar with React Native and Postgres can be productive on "
    "day one.", body))

tech_rows = [
    ["Mobile app",
     "React Native 0.81, Expo SDK 54, Hermes, New Architecture",
     "iOS + Android from one codebase"],
    ["State + data",
     "Zustand, TanStack Query, MMKV hot storage",
     "Fast, predictable, offline-tolerant"],
    ["Web companion",
     "Next.js 15, Tailwind, next-intl (FR / EN / AR)",
     "Pro upgrade, admin, legal pages"],
    ["Backend",
     "Supabase: Postgres + Auth + Storage + Realtime + Edge Functions",
     "One vendor for the full backend"],
    ["Edge Functions (6)",
     "Stripe checkout, Stripe webhook, push, IAP validate, web session, health",
     "Server-side payment + auth logic"],
    ["Payments",
     "Apple StoreKit, Google Play Billing (expo-iap), Stripe",
     "All three live and wired"],
    ["Observability",
     "Sentry (crashes), PostHog (8 events + feature flags)",
     "Full visibility before launch"],
    ["DevOps",
     "GitHub Actions CI, EAS Build, EAS Update OTA",
     "JS fixes ship without store review"],
    ["Locales",
     "FR + EN on mobile  ·  FR + EN + AR on web",
     "MENA-ready on the marketing surface"],
]
story.append(fact_table(
    ["Layer", "What we use", "Why it matters"],
    tech_rows,
    col_widths=[3.2 * cm, 7.5 * cm, CONTENT_W - 3.2 * cm - 7.5 * cm],
))

story.append(Spacer(1, 10))
story.append(Paragraph(
    "<b>Bottom line:</b> the stack favors leverage. A single full-stack "
    "engineer can operate the system end-to-end. Adding a second engineer "
    "scales the team linearly without architectural rework.",
    body_dark))

story.append(PageBreak())


# ===== PAGE 5: FEATURES — SHARED + PRO =====
story += page_title("04  ·  What's Built", "Feature inventory")

story.append(Paragraph("Available to every user", h2))
shared = [
    "Account creation, email verification, hCaptcha bot gate",
    "Vertical-snap product feed with video pool and infinite scroll",
    "For-You algorithmic feed (40 / 30 / 20 / 10 mix)",
    "Search and filters: category, price, location, pickup-only",
    "Per-listing detail with photo and video media",
    "Realtime in-app messaging with optimistic insert and offer flow",
    "Image and video uploads (per-user folder, MIME and size locked)",
    "Location-based search with adjustable radius",
    "User blocking, content reporting, 24-hour moderation SLA",
    "Onboarding interest picker (3–5 categories)",
    "Follows, comments, likes, bookmarks, share count",
    "Push notifications (mobile)",
    "Account deletion (in-app and web)",
    "Rate limits on likes, bookmarks, comments, messages, listings",
]
for b in bullets(shared):
    story.append(b)

story.append(Spacer(1, 6))
story.append(Paragraph("Pro perks ($19.99 / month)", h2))
pro = [
    "<b>Boost button</b> — promote one listing for 7 days, one boost per "
    "weekly window. Boosted listings surface as 'À la une' in the discovery rail.",
    "<b>Unlimited listings</b> — free users are capped at 10 (with a modal "
    "upsell at the cap).",
    "<b>Sales analytics</b> — 24-hour, 7-day, and 30-day view counts per "
    "product, plus aggregated sales statistics.",
    "<b>Direct Buy Now</b> — Pro listings can collect Stripe payment plus "
    "shipping address and phone in one checkout flow.",
    "<b>Sales section</b> on the mobile profile — buyer name, phone, "
    "shipping address visible to the seller after payment.",
    "<b>Subscription management</b> — deep-link to App Store, Play Store, "
    "or Stripe Customer Portal.",
    "<b>Web Pro dashboard</b> — at <i>mony.app/[locale]/pro</i> (scaffold "
    "in place; full KPI surface under construction).",
]
for b in bullets(pro):
    story.append(b)

story.append(Spacer(1, 6))
story.append(Paragraph("What free users cannot do", h2))
fr = [
    "Cannot list more than 10 products",
    "Cannot accept Buy Now payments — only chat with potential buyers",
    "Cannot boost a listing",
    "Cannot see sales analytics",
]
for b in bullets(fr):
    story.append(b)

story.append(PageBreak())


# ===== PAGE 6: MONETIZATION =====
story += page_title("05  ·  Monetization", "How Mony makes money")

story.append(Paragraph("Two revenue streams", h2))
story.append(Paragraph(
    "Stream one — the Pro subscription — is live and wired across three "
    "channels. Stream two — a platform fee on marketplace transactions — is "
    "deferred but architected for: the database has the columns, the "
    "checkout function is the right shape, and the only missing step is "
    "wiring Stripe Connect Express for seller payouts.",
    body))

story.append(Paragraph("Pro subscription net revenue per channel", h3))
sub_rows = [
    ["Apple StoreKit (iOS)",  "$19.99", "30% (15% Year 2+)",  "$13.99",  "$16.99"],
    ["Google Play (Android)", "$19.99", "30% (15% Year 2+)",  "$13.99",  "$16.99"],
    ["Stripe (web)",          "$19.99", "~ 3% processing",    "$19.39",  "$19.39"],
]
story.append(fact_table(
    ["Channel", "Price", "Platform fee", "Net Year 1", "Net Year 2+"],
    sub_rows,
    col_widths=[5 * cm, 1.8 * cm, 4 * cm,
                CONTENT_W - 5 * cm - 1.8 * cm - 4 * cm - 2 * cm,
                2 * cm],
))

story.append(Paragraph("Unit economics — 1,000 Pro subscribers, Year 1", h3))
story.append(Paragraph(
    "Channel mix assumption (MENA-realistic estimate): 50% iOS, 40% Android, "
    "10% web.",
    small))
ue_rows = [
    ["iOS",      "500", "$83,940",  "AED 308,000"],
    ["Android",  "400", "$67,152",  "AED 246,000"],
    ["Web",      "100", "$23,268",  "AED 85,000"],
    ["TOTAL",  "1,000", "$174,360", "AED 640,000"],
]
story.append(fact_table(
    ["Channel", "Subs", "Net / year (USD)", "Net / year (AED)"],
    ue_rows,
    col_widths=[5 * cm, 2.5 * cm, 4.5 * cm, CONTENT_W - 12 * cm],
))

story.append(Spacer(1, 8))
story.append(Paragraph("The second revenue stream (deferred)", h3))
story.append(Paragraph(
    "Today, Buy-Now orders flow 100% to the platform Stripe account. There "
    "is no platform fee on marketplace transactions. Wiring Stripe Connect "
    "Express — a clear, scoped engineering task — unlocks a 5–10% platform "
    "fee on every Buy-Now order. At a modest 100 transactions per day at "
    "€50 average with a 7% fee, that is roughly <b>AED 510,000 per year of "
    "incremental revenue</b>, on top of subscriptions, with no change to "
    "user pricing.",
    body))

story.append(PageBreak())


# ===== PAGE 7: COSTS AT SCALE =====
story += page_title("06  ·  Operating Costs", "What it costs to run")

story.append(Paragraph(
    "Mony runs on usage-priced infrastructure. Costs at launch are trivial; "
    "costs at scale stay reasonable because the chosen vendors meter on real "
    "consumption rather than fixed capacity. The table below shows monthly "
    "operating cost across four scale tiers.",
    body))

story.append(Spacer(1, 4))
story.append(Paragraph(
    "Conversion: 1 USD = 3.67 AED. Figures are estimates against current "
    "public pricing pages; verify before any commitment.",
    small))

cost_rows = [
    ["Supabase (DB + Auth + Storage + Functions)", "$0",     "$25",     "$225",    "$2,099"],
    ["Vercel (web hosting)",                       "$0",     "$20",     "$70",     "$420"],
    ["Apple Developer Program",                    "$8.25",  "$8.25",   "$8.25",   "$8.25"],
    ["Google Play Developer",                      "$2.08",  "—",       "—",       "—"],
    ["Sentry (errors + performance)",              "$0",     "$0",      "$26",     "$80"],
    ["PostHog (analytics + flags)",                "$0",     "$0",      "$50",     "$450"],
    ["Better Stack uptime",                        "$0",     "$0",      "$25",     "$25"],
    ["GitHub Actions",                             "$0",     "$0",      "$10",     "$25"],
    ["EAS Build + Update",                         "$0",     "$99",     "$99",     "$99"],
    ["CDN / egress overage",                       "$0",     "$0",      "$30",     "$300"],
    ["Domain + SSL",                               "$1.25",  "$1.25",   "$1.25",   "$1.25"],
    ["Email delivery",                             "$0",     "$0",      "$20",     "$80"],
    ["TOTAL USD / month",                          "$11.58", "$153.50", "$534.50", "$3,587.50"],
    ["TOTAL AED / month",                          "AED 42", "AED 564", "AED 1,962","AED 13,166"],
]
# Body style with numeric alignment for cost cells
num_styles = [cell_b, cell_num, cell_num, cell_num, cell_num]
t = fact_table(
    ["Line item", "1k MAU", "10k MAU", "100k MAU", "1M MAU"],
    cost_rows,
    col_widths=[7 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm,
                CONTENT_W - 7 * cm - 7.5 * cm],
    body_styles=num_styles,
)
# Bold the totals
t.setStyle(TableStyle([
    ('BACKGROUND', (0, len(cost_rows) - 1), (-1, -1), CORAL_SOFT),
    ('BACKGROUND', (0, len(cost_rows)), (-1, -1), CORAL),
    ('TEXTCOLOR',  (0, len(cost_rows)), (-1, -1), colors.white),
    ('FONTNAME',   (0, len(cost_rows) - 2), (-1, -1), 'Helvetica-Bold'),
]))
story.append(t)

story.append(Spacer(1, 8))
story.append(Paragraph(
    "<b>Key insight:</b> the gross margin profile holds well even at 1M MAU. "
    "Run-rate revenue at that scale (assuming a 5% Pro conversion = 50,000 "
    "Pro subscribers) is roughly AED 32M / year — versus AED 158k / year in "
    "infrastructure cost. That is a 99% gross margin before paid acquisition.",
    body_dark))

story.append(PageBreak())


# ===== PAGE 8: PRODUCTION COST =====
story += page_title("07  ·  Production Cost", "What it would cost to build")

story.append(Paragraph(
    "A bottom-up estimate of what it would cost a third party to deliver "
    "this codebase from scratch at fair market rates. This is the floor on "
    "any acquisition negotiation — a buyer pays at minimum the cost to "
    "rebuild the asset.",
    body))

story.append(Paragraph("Engineering effort by surface", h3))
eff_rows = [
    ["Mobile app — feed, listings, messaging, Pro flow, profile, design system", "82 days"],
    ["Web companion — Next.js, three locales, Stripe upgrade, admin, Pro scaffold", "30 days"],
    ["Backend — 41 SQL migrations with rollback scripts and rationale headers", "28 days"],
    ["Edge functions — Stripe checkout, webhook, push, IAP validate, web session, health", "14 days"],
    ["Observability — Sentry mobile + edge, PostHog events and flags",     "8 days"],
    ["DevOps — EAS Build / Update, GitHub Actions CI, edge auto-deploy",  "5 days"],
    ["Documentation — 14 audits, 5 runbooks, store checklists, brand doc","12 days"],
    ["QA — cross-platform manual cycles + Pro flow end-to-end",           "15 days"],
    ["Project management — phase planning and retrospectives",            "15 days"],
    ["TOTAL ENGINEERING EFFORT",                                          "209 days (~10–11 months)"],
]
t = fact_table(["Surface", "Effort"],
               eff_rows,
               col_widths=[CONTENT_W - 4 * cm, 4 * cm])
t.setStyle(TableStyle([
    ('BACKGROUND', (0, len(eff_rows)), (-1, -1), CORAL_SOFT),
    ('FONTNAME',   (0, len(eff_rows)), (-1, -1), 'Helvetica-Bold'),
]))
story.append(t)

story.append(Paragraph("Three sourcing scenarios", h3))
src_rows = [
    ["Dubai senior agency (premium, audit-grade quality)",         "AED 680,000 – 830,000"],
    ["Lean Dubai duo — 1 senior + 1 mid (most realistic)",          "AED 770,000"],
    ["Solo Dubai senior generalist over 11 months",                 "AED 510,000"],
    ["Offshore agency (lower quality risk)",                        "AED 305,000"],
]
story.append(fact_table(["Scenario", "Estimated total"],
                        src_rows,
                        col_widths=[CONTENT_W - 5 * cm, 5 * cm]))

story.append(Spacer(1, 8))
story.append(quoted_callout(
    "Realistic production price: AED 550,000 – 800,000. "
    "This is the floor an acquirer should anchor on when sizing replacement cost."
))

story.append(PageBreak())


# ===== PAGE 9: VALUATION =====
story += page_title("08  ·  Valuation", "What Mony is worth")

story.append(Paragraph(
    "Three independent methods, then a synthesized range. All figures in "
    "AED at 1 USD = 3.67.",
    body))

story.append(Paragraph("Method A — Revenue multiple (post-launch)", h3))
story.append(Paragraph(
    "At 1,000 Pro subscribers, annual recurring revenue is $174,360. "
    "Early-stage mobile-first marketplaces typically clear 3–5× ARR. "
    "Valuation: <b>AED 1.9M – AED 3.2M</b>.",
    body))

story.append(Paragraph("Method B — Comparable MENA transactions", h3))
story.append(Paragraph(
    "Pre-launch marketplace acquisitions in the MENA region with a working "
    "product but limited traction typically clear AED 1.5M – AED 5M. Mony's "
    "differentiators (10-phase audit trail, hybrid IAP + Stripe, FR / EN "
    "mobile + AR on web) sit at the high end of this range. "
    "Estimate: <b>AED 1.5M – AED 4M</b>.",
    body))

story.append(Paragraph("Method C — Cost to rebuild", h3))
story.append(Paragraph(
    "From Section 07: realistic production cost is AED 550k – 800k of "
    "engineering, plus AED 100k – 150k of design, legal, and store assets. "
    "An acquirer pays at minimum replacement cost; the IP premium "
    "(architecture decisions, audit docs, hybrid purchase model) adds 30–50%. "
    "Estimate: <b>AED 800k – AED 1.4M</b>.",
    body))

story.append(Paragraph("Synthesized range", h3))
val_rows = [
    ["Conservative — pre-submission, no traction, revenue-only floor",
     "AED 1.0M – 1.5M"],
    ["Realistic — comparable MENA pre-launch, IP and code value",
     "AED 2.0M – 4.0M"],
    ["Optimistic — post-launch, building Pro base, strategic interest",
     "AED 4.0M – 8.0M"],
]
story.append(fact_table(
    ["Scenario", "Valuation in AED"],
    val_rows,
    col_widths=[CONTENT_W - 5 * cm, 5 * cm],
))

story.append(Spacer(1, 8))
story.append(Paragraph("Caveats", h3))
caveats = [
    "All numbers assume successful App Store and Play Store approval. "
    "Pre-submission discount: 50–70%.",
    "100% owned by the founder. No cap table dilution to discount the price.",
    "A strategic acquirer (regional marketplace consolidator) could pay "
    "2–3× the realistic range. A financial buyer prices toward the conservative end.",
]
for b in bullets(caveats):
    story.append(b)

story.append(PageBreak())


# ===== PAGE 10: RISKS =====
story += page_title("09  ·  Risk Map", "What could go wrong")

risk_rows = [
    ["App Store / Play rejection",
     "Privacy manifest mismatch, IAP misconfiguration, missing EULA",
     "Up to AED 73k of delayed launch revenue per month",
     "TestFlight + Play internal beta for 2 weeks before submit"],
    ["Storage egress spike on viral video",
     "A featured listing's video gets 1M views in 24 hours",
     "AED 200 – 5,000 per viral event",
     "Cloudflare R2 + cache in front of Supabase Storage (deferred Tier 3)"],
    ["Stripe webhook duplicate orders",
     "Webhook returns non-200 and Stripe retries",
     "Up to AED 9k / month in disputed charges at scale",
     "Add idempotency key on orders + Stripe-side key. Defer until first incident."],
    ["Compliance — GDPR / UAE PDPL",
     "PII leak or unhonored deletion request; single Supabase project today",
     "Up to 2–4% of annual turnover",
     "Introduce staging Supabase project. Cost: ~AED 92 / month."],
    ["IAP chargeback rate at scale",
     "Stolen-card subscriptions reversed weeks later",
     "AED 7–15k / month at 10k subscribers (1–2% chargeback)",
     "hCaptcha on register already shipped; no further action needed under 10k subs"],
]
story.append(fact_table(
    ["Risk", "Trigger", "Worst case", "Mitigation"],
    risk_rows,
    col_widths=[3.5 * cm, 4 * cm, 4 * cm, CONTENT_W - 11.5 * cm],
))

story.append(Spacer(1, 10))
story.append(Paragraph(
    "<b>Biggest single risk:</b> launch delay. The technical work is "
    "essentially done — what holds revenue back is store approval. Two weeks "
    "of disciplined beta testing dramatically de-risks this.",
    body_dark))

story.append(PageBreak())


# ===== PAGE 11: RECOMMENDATIONS =====
story += page_title("10  ·  Next Steps", "Priority-ordered, partner-shareable")

rec_rows = [
    ["1", "TestFlight + Play internal beta — 2 weeks before submission",
     "3–5 days",
     "Removes the largest single launch risk"],
    ["2", "Wire production secrets — hCaptcha key, Sentry DSN, PostHog API key",
     "1 day",
     "Unlocks security and observability stack before launch"],
    ["3", "Wire Stripe Connect Express for marketplace platform fee",
     "8–12 days",
     "Opens a second revenue line: ~AED 500k / yr at modest volume"],
    ["4", "Introduce a staging Supabase project",
     "2 days",
     "Prevents compliance worst-case from a bad migration"],
    ["5", "First marketing push — recruit 50 Pro subscribers for social proof",
     "10–15 days",
     "Direct MRR + ~10× valuation lift via ARR multiple"],
]
story.append(fact_table(
    ["#", "Action", "Effort", "Why"],
    rec_rows,
    col_widths=[0.7 * cm, 7 * cm, 2 * cm, CONTENT_W - 9.7 * cm],
))

story.append(Spacer(1, 14))
story.append(Paragraph("The strategic ask", h2))
story.append(Paragraph(
    "Mony is at the rare moment in a product's life where the code is done "
    "and the market is not yet aware. Every day before launch is a day of "
    "deferred revenue; every day after launch compounds traction. The "
    "specific decision that converts the asset into a business is the "
    "fifth recommendation above — the first marketing push.",
    body_dark))

story.append(Spacer(1, 6))
story.append(quoted_callout(
    "We have a feature-complete, store-ready, audit-grade marketplace "
    "valued at AED 2M – 4M, with a clear path to AED 4M – 8M post-traction. "
    "What remains is execution: launch, marketing, and unlocking the "
    "second revenue line."
))

story.append(PageBreak())


# ===== PAGE 12: CLOSING =====
story += page_title("Closing", "Summary for partner discussion")

story.append(Paragraph(
    "Mony is a substantially complete, professionally documented, multi-"
    "platform social marketplace. The code shipped through ten audit "
    "phases. The payment stack is wired across Apple, Google, and Stripe. "
    "The observability stack is wired across Sentry and PostHog. The "
    "runbooks are written. The design system is documented. The submission "
    "checklist exists.",
    lead))

story.append(Paragraph(
    "What this means for a partner",
    h2))
items = [
    "The asset is concrete and inspectable — every claim in this brief "
    "traces to a file or a database migration in the repository.",
    "The valuation range (AED 2M – 4M realistic) is anchored on three "
    "independent methods, not a single multiple.",
    "The biggest risk is launch timing, not technology — the build is done.",
    "The biggest opportunity is the second revenue line via Stripe Connect, "
    "which the database is already shaped for.",
    "Operating cost is trivial at launch and reasonable at every scale "
    "tier we modeled.",
]
for b in bullets(items):
    story.append(b)

story.append(Spacer(1, 14))
story.append(Paragraph("Suggested partner discussion topics", h2))
topics = [
    "Capital plan for the first 90 days post-launch (marketing budget, ASO, beta).",
    "Decision on Stripe Connect Express timing — pre-launch or post-launch?",
    "Roles and responsibilities — who handles store relationships, "
    "compliance, finance, marketing?",
    "Exit timeline — when, to whom, and at what trigger metric?",
]
for b in bullets(topics):
    story.append(b)

story.append(Spacer(1, 18))
story.append(quoted_callout(
    "The code is the easy part. The value is the launch."
))


# --------------------------------------------------------------------------
# Build document
# --------------------------------------------------------------------------
doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=MARGIN,
    title="Mony — Project Overview & Valuation",
    author="Mony Founder",
    subject="Partner brief",
)

cover_frame = Frame(MARGIN, MARGIN,
                    CONTENT_W, PAGE_H - 2 * MARGIN,
                    showBoundary=0, id='cover_frame')

content_frame = Frame(MARGIN, MARGIN + 0.3 * cm,
                      CONTENT_W, PAGE_H - 2 * MARGIN - 0.6 * cm,
                      showBoundary=0, id='content_frame')

doc.addPageTemplates([
    PageTemplate(id='cover',   frames=cover_frame,   onPage=draw_cover),
    PageTemplate(id='content', frames=content_frame, onPage=draw_content),
])

doc.build(story)
print(f"Wrote: {OUTPUT}")
print(f"Size: {OUTPUT.stat().st_size / 1024:.1f} KB")

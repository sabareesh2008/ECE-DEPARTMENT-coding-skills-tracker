"""
Generate exact template match PDF for CODEMETRIX using ReportLab.
"""
import os
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas

PAGE_WIDTH = 13.333 * inch
PAGE_HEIGHT = 7.5 * inch

# Exact Colors
BG_DARK = colors.HexColor("#081225")
BG_LIGHT = colors.HexColor("#F8FAFC")
CARD_WHITE = colors.HexColor("#FFFFFF")
CARD_NAVY = colors.HexColor("#0B1E36")
BORDER_LIGHT = colors.HexColor("#E2E8F0")
BORDER_NAVY = colors.HexColor("#1E293B")
SKY_BLUE = colors.HexColor("#0EA5E9")
TEXT_DARK = colors.HexColor("#0F172A")
TEXT_MUTED = colors.HexColor("#64748B")
TEXT_WHITE = colors.HexColor("#F8FAFC")

class PresentationCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            is_dark = (self._pageNumber == 1 or self._pageNumber == num_pages)
            self.draw_page_decorations(num_pages, is_dark)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages, is_dark):
        self.saveState()
        # Background
        self.setFillColor(BG_DARK if is_dark else BG_LIGHT)
        self.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
        
        # Footer
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#475569") if is_dark else colors.HexColor("#94A3B8"))
        self.drawString(50, 24, "C O D E M E T R I X")
        
        page_str = f"{self._pageNumber:02d}"
        self.drawRightString(PAGE_WIDTH - 50, 24, page_str)
        self.restoreState()

def get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle('DarkTitle', fontName='Helvetica-Bold', fontSize=34, leading=38, textColor=TEXT_WHITE, alignment=TA_LEFT))
    styles.add(ParagraphStyle('DarkSub', fontName='Helvetica-Oblique', fontSize=13, leading=16, textColor=SKY_BLUE, alignment=TA_LEFT))
    styles.add(ParagraphStyle('MetaKey', fontName='Helvetica-Bold', fontSize=9, leading=14, textColor=SKY_BLUE))
    styles.add(ParagraphStyle('MetaVal', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=TEXT_WHITE))
    
    styles.add(ParagraphStyle('Kicker', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=SKY_BLUE))
    styles.add(ParagraphStyle('SlideTitle', fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=TEXT_DARK))
    styles.add(ParagraphStyle('SlideSub', fontName='Helvetica', fontSize=10, leading=13, textColor=TEXT_MUTED))
    
    styles.add(ParagraphStyle('CardTitle', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=TEXT_DARK))
    styles.add(ParagraphStyle('CardDesc', fontName='Helvetica', fontSize=8.5, leading=11.5, textColor=TEXT_MUTED))
    styles.add(ParagraphStyle('NavyCardTitle', fontName='Helvetica-Bold', fontSize=10.5, leading=13, textColor=TEXT_WHITE, alignment=TA_CENTER))
    return styles

def create_header(kicker, title, subtitle, styles):
    content = [
        Paragraph(kicker.upper(), styles['Kicker']),
        Spacer(1, 2),
        Paragraph(title, styles['SlideTitle']),
    ]
    if subtitle:
        content.extend([Spacer(1, 2), Paragraph(subtitle, styles['SlideSub'])])
    
    t = Table([[content]], colWidths=[PAGE_WIDTH - 100])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    return t

def build_pdf():
    out_pdf = os.path.abspath("CodeMetrix_Presentation.pdf")
    doc = SimpleDocTemplate(
        out_pdf,
        pagesize=(PAGE_WIDTH, PAGE_HEIGHT),
        leftMargin=50,
        rightMargin=50,
        topMargin=35,
        bottomMargin=35
    )
    
    styles = get_styles()
    story = []
    
    # ---------------- SLIDE 1 ----------------
    left_meta = [
        Paragraph("&lt;&gt; &nbsp;<b>CODEMETRIX</b>", styles['Kicker']),
        Spacer(1, 14),
        Paragraph("CODEMETRIX", styles['DarkTitle']),
        Spacer(1, 4),
        Paragraph("From Coding Activity to Actionable Performance Insights", styles['DarkSub']),
        Spacer(1, 28),
        Table([
            [Paragraph("TEAM NAME", styles['MetaKey']), Paragraph("CodeMetrix", styles['MetaVal'])],
            [Paragraph("TEAM MEMBERS", styles['MetaKey']), Paragraph("Sabareesh K &nbsp;•&nbsp; Sabarivasan P &nbsp;•&nbsp; Roshan M", styles['MetaVal'])],
            [Paragraph("DEPARTMENT", styles['MetaKey']), Paragraph("II ECE E", styles['MetaVal'])],
        ], colWidths=[120, 320], style=[
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
        ])
    ]
    
    qr_card = [
        Spacer(1, 10),
        Paragraph("<font size=48 color='#0F172A'>▣</font>", ParagraphStyle('Q', alignment=TA_CENTER)),
        Spacer(1, 10),
        Paragraph("SCAN TO VIEW<br/><b>CODEMETRIX</b>", ParagraphStyle('QTxt', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=TEXT_DARK, alignment=TA_CENTER))
    ]
    t_qr = Table([[qr_card]], colWidths=[170], rowHeights=[230])
    t_qr.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_WHITE),
        ('ROUNDEDCORNERS', [12, 12, 12, 12]),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    
    s1_table = Table([[left_meta, t_qr]], colWidths=[PAGE_WIDTH - 300, 200])
    s1_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(Spacer(1, 20))
    story.append(s1_table)
    story.append(PageBreak())
    
    # ---------------- SLIDE 2 ----------------
    story.append(create_header("THE CHALLENGE", "Problem Statement", "Students practice coding on platforms like LeetCode and GitHub, but faculty often lack a centralized system to track and evaluate that progress effectively.", styles))
    story.append(Spacer(1, 14))
    
    w3 = (PAGE_WIDTH - 100 - 24) / 3.0
    s2_cards = [
        [Paragraph("📋 &nbsp;<b>Manual Tracking</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Manual tracking of students' coding progress across individual profiles.", styles['CardDesc'])],
        [Paragraph("👥 &nbsp;<b>Hard to Monitor at Scale</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Difficult to monitor hundreds of students and keep records continually updated.", styles['CardDesc'])],
        [Paragraph("👤✕ &nbsp;<b>Inactive Students Missed</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Faculty cannot easily identify inactive students early for timely guidance.", styles['CardDesc'])],
        [Paragraph("🔀 &nbsp;<b>Scattered Data & Copy-Paste</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Coding submissions are scattered across platforms without code authenticity verification.", styles['CardDesc'])],
        [Paragraph("📊 &nbsp;<b>No Easy Comparison</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Difficult to compare section-wise performance, daily streaks, and authentic logic building.", styles['CardDesc'])],
        [Paragraph("🗂️ &nbsp;<b>Database Storage Limits</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Saving raw code files rapidly consumes free cloud quotas without an automated 50-limit purge.", styles['CardDesc'])],
    ]
    t2 = Table([s2_cards[:3], s2_cards[3:]], colWidths=[w3, w3, w3], rowHeights=[140, 140])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_WHITE),
        ('BOX', (0,0), (0,0), 1, BORDER_LIGHT),
        ('BOX', (1,0), (1,0), 1, BORDER_LIGHT),
        ('BOX', (2,0), (2,0), 1, BORDER_LIGHT),
        ('BOX', (0,1), (0,1), 1, BORDER_LIGHT),
        ('BOX', (1,1), (1,1), 1, BORDER_LIGHT),
        ('BOX', (2,1), (2,1), 1, BORDER_LIGHT),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('TOPPADDING', (0,0), (-1,-1), 14),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t2)
    story.append(PageBreak())
    
    # ---------------- SLIDE 3 ----------------
    story.append(create_header("THE APPROACH", "Proposed Solution", "CodeMetrix is a centralized dashboard that automatically collects and analyzes students' LeetCode and GitHub activity, and presents it through student, section, and faculty dashboards.", styles))
    story.append(Spacer(1, 16))
    
    w4 = (PAGE_WIDTH - 100 - 36) / 4.0
    top_navy = [
        [Paragraph("🔗<br/><b>LeetCode &amp; GitHub</b>", styles['NavyCardTitle'])],
        [Paragraph("⚡<br/><b>Automated Data Collection</b>", styles['NavyCardTitle'])],
        [Paragraph("⚙️<br/><b>Data Processing &amp; Forensics</b>", styles['NavyCardTitle'])],
        [Paragraph("🗄️<br/><b>Supabase Database</b>", styles['NavyCardTitle'])]
    ]
    t3_top = Table([top_navy], colWidths=[w4, w4, w4, w4], rowHeights=[70])
    t3_top.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_NAVY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_NAVY),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t3_top)
    story.append(Spacer(1, 12))
    
    # Pill
    pill_t = Table([[Paragraph("<b>CODEMETRIX</b>", ParagraphStyle('P', fontName='Helvetica-Bold', fontSize=12, textColor=TEXT_DARK, alignment=TA_CENTER))]], colWidths=[240], rowHeights=[32])
    pill_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SKY_BLUE),
        ('ROUNDEDCORNERS', [16, 16, 16, 16]),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(Table([[pill_t]], colWidths=[PAGE_WIDTH - 100], style=[('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    story.append(Spacer(1, 12))
    
    # Bottom 3 white cards
    bot_cards = [
        [Paragraph("💻 &nbsp;<b>Student Dashboard</b>", ParagraphStyle('B', fontName='Helvetica-Bold', fontSize=11, textColor=TEXT_DARK, alignment=TA_CENTER))],
        [Paragraph("📊 &nbsp;<b>Faculty Analytics</b>", ParagraphStyle('B', fontName='Helvetica-Bold', fontSize=11, textColor=TEXT_DARK, alignment=TA_CENTER))],
        [Paragraph("🛡️ &nbsp;<b>Admin Dashboard</b>", ParagraphStyle('B', fontName='Helvetica-Bold', fontSize=11, textColor=TEXT_DARK, alignment=TA_CENTER))]
    ]
    t3_bot = Table([bot_cards], colWidths=[w3, w3, w3], rowHeights=[75])
    t3_bot.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_WHITE),
        ('BOX', (0,0), (0,0), 1, BORDER_LIGHT),
        ('BOX', (1,0), (1,0), 1, BORDER_LIGHT),
        ('BOX', (2,0), (2,0), 1, BORDER_LIGHT),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t3_bot)
    story.append(PageBreak())
    
    # ---------------- SLIDE 4 ----------------
    story.append(create_header("UNDER THE HOOD", "Technology Stack", "", styles))
    story.append(Spacer(1, 14))
    
    c1 = [
        Paragraph("<b>HTML</b>", styles['CardTitle']), Paragraph("Builds the structure of the web dashboard", styles['CardDesc']), Spacer(1, 6),
        Paragraph("<b>CSS</b>", styles['CardTitle']), Paragraph("Creates the responsive and modern UI", styles['CardDesc']), Spacer(1, 6),
        Paragraph("<b>JavaScript &amp; JSZip</b>", styles['CardTitle']), Paragraph("Handles interactions, filtering, search &amp; 1-click ZIP downloads", styles['CardDesc'])
    ]
    c2 = [
        Paragraph("<b>Python</b>", styles['CardTitle']), Paragraph("Automates LeetCode/GitHub data collection and processing", styles['CardDesc']), Spacer(1, 6),
        Paragraph("<b>GitHub Actions</b>", styles['CardTitle']), Paragraph("Runs automated trackers periodically without manual execution", styles['CardDesc']), Spacer(1, 6),
        Paragraph("<b>Monaco DOM Hook</b>", styles['CardTitle']), Paragraph("Browser extension capturing typing rhythm and paste counts", styles['CardDesc'])
    ]
    c3 = [
        Paragraph("<b>SQL &amp; Triggers</b>", styles['CardTitle']), Paragraph("Auto-replace deduplication constraints &amp; 50-problem purge", styles['CardDesc']), Spacer(1, 6),
        Paragraph("<b>Supabase</b>", styles['CardTitle']), Paragraph("Stores student profiles, coding data and application data", styles['CardDesc']), Spacer(1, 6),
        Paragraph("<b>Row Level Security</b>", styles['CardTitle']), Paragraph("Guarantees secure access across faculty and student portals", styles['CardDesc'])
    ]
    
    t4_heads = Table([[
        Paragraph("FRONTEND", styles['NavyCardTitle']),
        Paragraph("AUTOMATION &amp; PROCESSING", styles['NavyCardTitle']),
        Paragraph("DATABASE &amp; AUTHENTICATION", styles['NavyCardTitle'])
    ]], colWidths=[w3, w3, w3], rowHeights=[28])
    t4_heads.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_NAVY),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    
    t4_body = Table([[c1, c2, c3]], colWidths=[w3, w3, w3], rowHeights=[260])
    t4_body.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_WHITE),
        ('BOX', (0,0), (0,0), 1, BORDER_LIGHT),
        ('BOX', (1,0), (1,0), 1, BORDER_LIGHT),
        ('BOX', (2,0), (2,0), 1, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t4_heads)
    story.append(t4_body)
    story.append(PageBreak())
    
    # ---------------- SLIDE 5 ----------------
    story.append(create_header("HOW IT WORKS", "System Architecture", "", styles))
    story.append(Spacer(1, 14))
    
    w2 = (PAGE_WIDTH - 100 - 16) / 2.0
    r1 = Table([[
        [Paragraph("<font color='#0EA5E9'><b>LeetCode</b></font><br/>• Problems solved (E / M / H) &nbsp;• Daily activity &amp; submissions", styles['NavyCardTitle'])],
        [Paragraph("<font color='#0EA5E9'><b>GitHub</b></font><br/>• Repositories &amp; commits &nbsp;• Contribution activity", styles['NavyCardTitle'])]
    ]], colWidths=[w2, w2], rowHeights=[50], style=[
        ('BACKGROUND', (0,0), (-1,-1), CARD_NAVY),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE')
    ])
    story.append(r1)
    story.append(Spacer(1, 8))
    
    r2 = Table([[
        [Paragraph("<b>Python — Processing Engine</b><br/><font color='#64748B'>• Fetch data &nbsp;• Process and clean data &nbsp;• Validate deduplication &nbsp;• Enforce 50-limit window</font>", styles['CardTitle'])]
    ]], colWidths=[PAGE_WIDTH - 100], rowHeights=[45], style=[
        ('BACKGROUND', (0,0), (-1,-1), CARD_WHITE),
        ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 14)
    ])
    story.append(r2)
    story.append(Spacer(1, 8))
    
    r3 = Table([[
        [Paragraph("<b>GitHub Actions</b><br/><font color='#64748B'>• Scheduled execution &nbsp;• Runs trackers automatically</font>", styles['CardTitle'])],
        [Paragraph("<b>Supabase (PostgreSQL)</b><br/><font color='#64748B'>• Central data store &nbsp;• Auto-prune triggers &nbsp;• Powers all dashboards</font>", styles['CardTitle'])]
    ]], colWidths=[w2, w2], rowHeights=[45], style=[
        ('BACKGROUND', (0,0), (-1,-1), CARD_WHITE),
        ('BOX', (0,0), (0,0), 1, BORDER_LIGHT),
        ('BOX', (1,0), (1,0), 1, BORDER_LIGHT),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 14)
    ])
    story.append(r3)
    story.append(Spacer(1, 8))
    
    r4 = Table([[
        [Paragraph("<font color='#0EA5E9'><b>Student Dashboard</b></font><br/>• Solved breakdown &nbsp;• 1-Click ZIP archive", styles['NavyCardTitle'])],
        [Paragraph("<font color='#0EA5E9'><b>Faculty Analytics</b></font><br/>• Section comparison &nbsp;• In-modal code viewer", styles['NavyCardTitle'])],
        [Paragraph("<font color='#0EA5E9'><b>Admin Dashboard</b></font><br/>• Anti-paste forensics &nbsp;• Excel reports", styles['NavyCardTitle'])]
    ]], colWidths=[w3, w3, w3], rowHeights=[55], style=[
        ('BACKGROUND', (0,0), (-1,-1), CARD_NAVY),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE')
    ])
    story.append(r4)
    story.append(PageBreak())
    
    # ---------------- SLIDE 6 ----------------
    story.append(create_header("WHAT IT DELIVERS", "Key Features", "", styles))
    story.append(Spacer(1, 14))
    
    s6_cards = [
        [Paragraph("⚡ &nbsp;<b>Automated LeetCode &amp; GitHub Tracking</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Daily background scraping captures solved counts, streaks, and difficulty breakdowns automatically.", styles['CardDesc'])],
        [Paragraph("📊 &nbsp;<b>Section-wise Analysis</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Instant filtering across sections with ranked leaderboards and detailed student modals.", styles['CardDesc'])],
        [Paragraph("👤✕ &nbsp;<b>Inactive Students Detection</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Early identification of students with broken practice streaks for prompt academic mentoring.", styles['CardDesc'])],
        [Paragraph("⚠️ &nbsp;<b>Suspicious Solving &amp; Anti-Paste</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Extension tracks typing vs paste deltas to flag AI-pasted code while keeping short one-liners clean.", styles['CardDesc'])],
        [Paragraph("📦 &nbsp;<b>50-Problem Download &amp; Auto-Purge</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("1-click ZIP and Excel archive of solved files with automatic database reset to maintain free cloud limits.", styles['CardDesc'])],
        [Paragraph("🔄 &nbsp;<b>Duplicate Prevention</b>", styles['CardTitle']), Spacer(1, 4), Paragraph("Re-submitted problems automatically replace older records, guaranteeing zero duplicate entries.", styles['CardDesc'])],
    ]
    t6 = Table([s6_cards[:3], s6_cards[3:]], colWidths=[w3, w3, w3], rowHeights=[140, 140], style=[
        ('BACKGROUND', (0,0), (-1,-1), CARD_WHITE),
        ('BOX', (0,0), (0,0), 1, BORDER_LIGHT),
        ('BOX', (1,0), (1,0), 1, BORDER_LIGHT),
        ('BOX', (2,0), (2,0), 1, BORDER_LIGHT),
        ('BOX', (0,1), (0,1), 1, BORDER_LIGHT),
        ('BOX', (1,1), (1,1), 1, BORDER_LIGHT),
        ('BOX', (2,1), (2,1), 1, BORDER_LIGHT),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('TOPPADDING', (0,0), (-1,-1), 14),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ])
    story.append(t6)
    story.append(PageBreak())
    
    # ---------------- SLIDE 7 ----------------
    story.append(create_header("WHAT SETS US APART", "Innovation", "", styles))
    story.append(Spacer(1, 14))
    
    s7_cards = [
        [Paragraph("🥞 &nbsp;<b>Unified Coding Intelligence</b>", styles['CardTitle']), Spacer(1, 3), Paragraph("Combines LeetCode + GitHub activity into one intelligence layer.", styles['CardDesc'])],
        [Paragraph("⚡ &nbsp;<b>Real-Time Extension Telemetry</b>", styles['CardTitle']), Spacer(1, 3), Paragraph("Monitors Monaco editor keystroke rhythm directly in-browser with zero external server latency.", styles['CardDesc'])],
        [Paragraph("🛡️ &nbsp;<b>Pattern-Based Integrity Checks</b>", styles['CardTitle']), Spacer(1, 3), Paragraph("Physical keystroke counting and smart one-liner tolerance (<=220 chars) eliminate false alarms.", styles['CardDesc'])],
        [Paragraph("🗄️ &nbsp;<b>Self-Pruning Cloud Architecture</b>", styles['CardTitle']), Spacer(1, 3), Paragraph("Maintains perpetual free-tier operation via automated rolling 50-problem pruning and offline archives.", styles['CardDesc'])],
        [Paragraph("📊 &nbsp;<b>Data-Driven Reporting</b>", styles['CardTitle']), Spacer(1, 3), Paragraph("Historical and section-wise data-driven reporting formatted for reviews.", styles['CardDesc'])],
        [Paragraph("✉️ &nbsp;<b>Automated Delivery</b>", styles['CardTitle']), Spacer(1, 3), Paragraph("Automatic report sending and email updates for class advisors.", styles['CardDesc'])],
    ]
    t7 = Table([s7_cards[0:2], s7_cards[2:4], s7_cards[4:6]], colWidths=[w2, w2], rowHeights=[85, 85, 85], style=[
        ('BACKGROUND', (0,0), (-1,-1), CARD_WHITE),
        ('BOX', (0,0), (0,0), 1, BORDER_LIGHT),
        ('BOX', (1,0), (1,0), 1, BORDER_LIGHT),
        ('BOX', (0,1), (0,1), 1, BORDER_LIGHT),
        ('BOX', (1,1), (1,1), 1, BORDER_LIGHT),
        ('BOX', (0,2), (0,2), 1, BORDER_LIGHT),
        ('BOX', (1,2), (1,2), 1, BORDER_LIGHT),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ])
    story.append(t7)
    story.append(PageBreak())
    
    # ---------------- SLIDE 8 ----------------
    story.append(create_header("WHY IT MATTERS", "Impact", "", styles))
    story.append(Spacer(1, 14))
    
    t8_data = [
        [Paragraph("<b>IMPACT</b>", styles['NavyCardTitle']), Paragraph("<b>RESULT</b>", styles['NavyCardTitle'])],
        [Paragraph("<b>Consistent Practice</b>", styles['CardTitle']), Paragraph("Daily coding habit fostered across all students", styles['CardDesc'])],
        [Paragraph("<b>Reduced Workload</b>", styles['CardTitle']), Paragraph("Automated monitoring saves 15+ faculty hours weekly", styles['CardDesc'])],
        [Paragraph("<b>Early Intervention</b>", styles['CardTitle']), Paragraph("Inactive students identified quickly for counseling", styles['CardDesc'])],
        [Paragraph("<b>Data-Driven Decisions</b>", styles['CardTitle']), Paragraph("Meaningful analytics for section-level performance reviews", styles['CardDesc'])],
        [Paragraph("<b>Academic Integrity</b>", styles['CardTitle']), Paragraph("Unusual solving patterns and copy-paste dumps flagged", styles['CardDesc'])],
        [Paragraph("<b>Storage Sustainability</b>", styles['CardTitle']), Paragraph("50-problem auto-pruning enables perpetual zero-cost operation", styles['CardDesc'])],
    ]
    t8 = Table(t8_data, colWidths=[260, PAGE_WIDTH - 100 - 260], rowHeights=[28] + [34]*6, style=[
        ('BACKGROUND', (0,0), (-1,0), CARD_NAVY),
        ('BACKGROUND', (0,1), (-1,-1), CARD_WHITE),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
    ])
    story.append(t8)
    story.append(PageBreak())
    
    # ---------------- SLIDE 9 ----------------
    story.append(create_header("WHAT'S NEXT", "Future Scope", "", styles))
    story.append(Spacer(1, 14))
    
    future_data = [
        [Paragraph("🧠 &nbsp;<b>AI-Based Performance &amp; Complexity Optimization Hints</b>", styles['CardTitle'])],
        [Paragraph("🔍 &nbsp;<b>Advanced Anomaly &amp; Code Quality Detection</b>", styles['CardTitle'])],
        [Paragraph("💻 &nbsp;<b>Complete Online Department Coding Test Platform</b>", styles['CardTitle'])],
        [Paragraph("📱 &nbsp;<b>Mobile App &amp; Automated Telegram/WhatsApp Notifications</b>", styles['CardTitle'])],
        [Paragraph("🔗 &nbsp;<b>Integration with Multiple Coding Platforms (Codeforces, HackerRank, GFG)</b>", styles['CardTitle'])],
    ]
    t9 = Table(future_data, colWidths=[PAGE_WIDTH - 100], rowHeights=[44]*5, style=[
        ('BACKGROUND', (0,0), (-1,-1), CARD_WHITE),
        ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
    ])
    story.append(t9)
    story.append(Spacer(1, 14))
    
    v_box = Table([[Paragraph("<i>\"The future vision of CodeMetrix is to evolve from a coding activity tracker into an intelligent, personalized coding education platform.\"</i>", ParagraphStyle('V', fontName='Helvetica-Oblique', fontSize=9.5, textColor=TEXT_WHITE, alignment=TA_CENTER))]], colWidths=[PAGE_WIDTH - 100], rowHeights=[36], style=[
        ('BACKGROUND', (0,0), (-1,-1), CARD_NAVY),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ])
    story.append(v_box)
    story.append(PageBreak())
    
    # ---------------- SLIDE 10 ----------------
    s10_content = [
        Paragraph("<font size=20 color='#0EA5E9'><b>&lt;&gt;</b></font>", ParagraphStyle('I10', alignment=TA_CENTER)),
        Spacer(1, 12),
        Paragraph("THANK YOU", ParagraphStyle('T10', fontName='Helvetica-Bold', fontSize=38, leading=42, textColor=TEXT_WHITE, alignment=TA_CENTER)),
        Spacer(1, 6),
        Paragraph("CODEMETRIX &nbsp;•&nbsp; From Coding Activity to Actionable Performance Insights", ParagraphStyle('S10', fontName='Helvetica', fontSize=12, leading=15, textColor=SKY_BLUE, alignment=TA_CENTER))
    ]
    t10 = Table([[s10_content]], colWidths=[PAGE_WIDTH - 160], rowHeights=[260])
    t10.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(Spacer(1, 60))
    story.append(t10)
    
    doc.build(story, canvasmaker=PresentationCanvas)
    
    import shutil
    shutil.copyfile(out_pdf, os.path.abspath("ECE_CodeMetrix_Presentation.pdf"))
    print(f"PDF saved successfully to {out_pdf}")

if __name__ == "__main__":
    build_pdf()

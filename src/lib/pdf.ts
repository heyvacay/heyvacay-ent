/**
 * Client-side PDF generation for the Sales console (Nova).
 *
 * Real .pdf files built with jsPDF — no server round-trip. Three documents:
 *  - accountOnePagerPdf: a one-page account brief for a company
 *  - contractPdf: a formatted contract from the wizard's terms
 *  - pipelineReportPdf: a rep's book-of-business report
 *
 * All share a small layout engine (brand header, section headings, key/value
 * rows, wrapped paragraphs, a cursor that auto-paginates).
 */
import { jsPDF } from 'jspdf';
import { LOGO_WHITE_PNG, LOGO_RATIO } from './logoData';
import {
  CONTRACT_TYPE_LABEL,
  PRICING_LABEL,
  STATUS_LABEL,
  DEAL_STAGE_LABEL,
  onboardingPct,
  weightedPipeline,
  openPipeline,
  wonValue,
  winRate,
  type Contract,
  type SalesCompany,
} from './crm';
import { money } from './format';

const NAVY: [number, number, number] = [10, 20, 38];
const BRAND: [number, number, number] = [16, 195, 212];
const SLATE: [number, number, number] = [71, 85, 105];
const LIGHT: [number, number, number] = [148, 163, 184];

const MARGIN = 54;
const PAGE_W = 595; // A4 portrait pt
const PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface Doc {
  pdf: jsPDF;
  y: number;
}

function newDoc(): Doc {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  return { pdf, y: 0 };
}

function ensureSpace(d: Doc, needed: number) {
  if (d.y + needed > PAGE_H - MARGIN) {
    d.pdf.addPage();
    d.y = MARGIN;
  }
}

function brandHeader(d: Doc, kicker: string, title: string) {
  const { pdf } = d;
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, PAGE_W, 96, 'F');
  pdf.setFillColor(...BRAND);
  pdf.rect(0, 96, PAGE_W, 4, 'F');

  // Real HeyVacay logo (white) + a small blue ENTERPRISE lockup.
  const logoH = 26;
  const logoW = logoH * LOGO_RATIO;
  const logoY = 20;
  try {
    pdf.addImage(LOGO_WHITE_PNG, 'PNG', MARGIN, logoY, logoW, logoH, 'hvlogo', 'FAST');
  } catch {
    // Fallback to a text wordmark if the image can't be embedded.
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('heyvacay', MARGIN, 42);
  }
  pdf.setTextColor(...BRAND);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('ENTERPRISE', MARGIN + logoW + 8, logoY + logoH - 2);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(kicker.toUpperCase(), MARGIN, 58);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text(title, MARGIN, 80);

  d.y = 128;
}

function heading(d: Doc, text: string) {
  ensureSpace(d, 40);
  d.pdf.setTextColor(...NAVY);
  d.pdf.setFont('helvetica', 'bold');
  d.pdf.setFontSize(12);
  d.pdf.text(text, MARGIN, d.y);
  d.y += 8;
  d.pdf.setDrawColor(...BRAND);
  d.pdf.setLineWidth(1.5);
  d.pdf.line(MARGIN, d.y, MARGIN + 26, d.y);
  d.y += 16;
}

function paragraph(d: Doc, text: string, opts: { size?: number; color?: [number, number, number] } = {}) {
  const size = opts.size ?? 10;
  d.pdf.setFont('helvetica', 'normal');
  d.pdf.setFontSize(size);
  d.pdf.setTextColor(...(opts.color ?? SLATE));
  const lines = d.pdf.splitTextToSize(text, CONTENT_W) as string[];
  for (const ln of lines) {
    ensureSpace(d, size + 4);
    d.pdf.text(ln, MARGIN, d.y);
    d.y += size + 4;
  }
}

/** A two-column grid of key/value pairs. */
function kvGrid(d: Doc, rows: [string, string][], cols = 2) {
  const colW = CONTENT_W / cols;
  const rowH = 34;
  for (let i = 0; i < rows.length; i += cols) {
    ensureSpace(d, rowH);
    for (let c = 0; c < cols; c++) {
      const row = rows[i + c];
      if (!row) continue;
      const x = MARGIN + c * colW;
      d.pdf.setFont('helvetica', 'normal');
      d.pdf.setFontSize(8);
      d.pdf.setTextColor(...LIGHT);
      d.pdf.text(row[0].toUpperCase(), x, d.y);
      d.pdf.setFont('helvetica', 'bold');
      d.pdf.setFontSize(11);
      d.pdf.setTextColor(...NAVY);
      d.pdf.text(row[1], x, d.y + 15);
    }
    d.y += rowH;
  }
  d.y += 4;
}

function bullet(d: Doc, text: string) {
  ensureSpace(d, 16);
  d.pdf.setFillColor(...BRAND);
  d.pdf.circle(MARGIN + 3, d.y - 3, 2, 'F');
  d.pdf.setFont('helvetica', 'normal');
  d.pdf.setFontSize(10);
  d.pdf.setTextColor(...SLATE);
  const lines = d.pdf.splitTextToSize(text, CONTENT_W - 16) as string[];
  lines.forEach((ln, i) => {
    if (i > 0) ensureSpace(d, 14);
    d.pdf.text(ln, MARGIN + 14, d.y);
    d.y += 14;
  });
  d.y += 2;
}

function footer(d: Doc, label: string) {
  const pages = d.pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    d.pdf.setPage(p);
    d.pdf.setFont('helvetica', 'normal');
    d.pdf.setFontSize(8);
    d.pdf.setTextColor(...LIGHT);
    d.pdf.text(label, MARGIN, PAGE_H - 28);
    d.pdf.text(`Page ${p} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 28, { align: 'right' });
  }
}

const today = () =>
  new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/* ---------------- account one-pager ---------------- */

export function accountOnePagerPdf(c: SalesCompany) {
  const d = newDoc();
  brandHeader(d, 'Account brief', c.name);

  paragraph(
    d,
    `${c.industry} · ${c.tier} · ${c.employees} employees · ${c.hq}`,
    { size: 10, color: LIGHT }
  );
  d.y += 8;

  heading(d, 'Account snapshot');
  kvGrid(d, [
    ['Status', STATUS_LABEL[c.status]],
    ['Account manager', c.accountManager ?? 'Unassigned'],
    ['Annual travel spend', money(c.annualSpend)],
    ['Savings delivered', money(c.savings)],
    ['Est. annual savings', `${money(Math.round(c.annualSpend * 0.15))} (~15%)`],
    ['Health score', `${c.health}/100`],
    ['Onboarding', `${onboardingPct(c)}% complete`],
    ['Domain', c.domain],
    ['Customer since', c.createdAt],
  ]);

  if (c.nextStep) {
    heading(d, 'Next step');
    paragraph(d, c.nextStep);
    d.y += 6;
  }

  heading(d, 'Key contacts');
  if (c.contacts.length === 0) paragraph(d, 'No contacts on file yet.', { color: LIGHT });
  c.contacts.forEach((p) =>
    bullet(d, `${p.name} — ${p.title}${p.champion ? ' (champion)' : ''} · ${p.email}${p.phone ? ` · ${p.phone}` : ''}`)
  );
  d.y += 6;

  if (c.deals.length) {
    heading(d, 'Open opportunities');
    c.deals
      .filter((dl) => dl.stage !== 'won' && dl.stage !== 'lost')
      .forEach((dl) =>
        bullet(d, `${dl.name} — ${money(dl.value)} · ${DEAL_STAGE_LABEL[dl.stage]} · ${dl.probability}% · close ${dl.closeDate}`)
      );
    d.y += 6;
  }

  if (c.activity.length) {
    heading(d, 'Recent activity');
    c.activity.slice(0, 6).forEach((a) => bullet(d, `${a.date} — ${a.text}`));
  }

  footer(d, `HeyVacay Enterprise · Account brief · Generated ${today()}`);
  d.pdf.save(`${slug(c.name)}-account-brief.pdf`);
}

/* ---------------- contract ---------------- */

export function contractPdf(c: SalesCompany, ct: Contract) {
  const d = newDoc();
  const t = ct.terms;
  brandHeader(d, CONTRACT_TYPE_LABEL[t.type], c.name);

  paragraph(
    d,
    `This ${CONTRACT_TYPE_LABEL[t.type]} ("Agreement") is entered into as of ${t.startDate} by and between HeyVacay, Inc. ("HeyVacay") and ${c.name} ("Customer").`
  );
  d.y += 10;

  heading(d, '1. Commercial terms');
  kvGrid(d, [
    ['Pricing model', PRICING_LABEL[t.pricingModel]],
    ['Commission', `${t.commissionPct}% of booking value`],
    ['Platform fee', t.platformFee > 0 ? `${money(t.platformFee)}/yr` : 'None'],
    ['Customer discount', t.discountPct > 0 ? `${t.discountPct}%` : 'None'],
    ['Term', `${t.termMonths} months`],
    ['Start date', t.startDate],
    ['Payment terms', t.paymentTerms],
    ['Minimum annual spend', t.minimumSpend > 0 ? money(t.minimumSpend) : 'No commitment'],
  ]);

  const estSavings = Math.round(c.annualSpend * 0.15);
  paragraph(
    d,
    `Based on Customer's reported annual travel spend of ${money(c.annualSpend)}, HeyVacay projects estimated annual savings of approximately ${money(estSavings)} (~15%) through negotiated rates and policy controls. Savings are an estimate, not a guarantee.`,
    { color: SLATE }
  );
  d.y += 8;

  heading(d, '2. Scope of services');
  paragraph(
    d,
    'HeyVacay will provide Customer access to its corporate travel and expense platform, including flight and hotel booking, policy controls, budgets, approvals, expense management, and savings rewards. HeyVacay sources inventory from its supply partners and passes negotiated rates through to Customer. HeyVacay may add, modify, or deprecate features over time provided it does not materially reduce the core functionality during the Term.'
  );
  d.y += 4;

  heading(d, '3. Fees & payment');
  paragraph(
    d,
    `Fees are as set out in Section 1 and are exclusive of taxes, which are Customer's responsibility. Invoiced amounts are due ${t.paymentTerms}. Undisputed amounts not paid when due accrue interest at the lesser of 1.5% per month or the maximum permitted by law, and HeyVacay may suspend services on 10 days' written notice of non-payment. Fees are non-refundable except as expressly stated. Customer will reimburse reasonable costs of collection for overdue, undisputed amounts.`
  );
  d.y += 4;

  heading(d, '4. Term, renewal & termination');
  paragraph(
    d,
    `This Agreement begins on ${t.startDate} and continues for ${t.termMonths} months (the "Initial Term"). ${
      t.autoRenew
        ? 'It then renews automatically for successive terms of equal length unless either party gives written notice of non-renewal at least 30 days before the end of the then-current term.'
        : 'It does not renew automatically; renewal requires a new written order.'
    } Either party may terminate for material breach that remains uncured 30 days after written notice. HeyVacay may terminate immediately for non-payment or misuse of the platform. ${
      t.minimumSpend > 0
        ? `Customer has committed to a minimum annual spend of ${money(t.minimumSpend)}; early termination by Customer without cause does not relieve Customer of committed amounts for the then-current term.`
        : 'Fees already incurred remain payable on termination.'
    }`
  );
  d.y += 4;

  heading(d, '5. Confidentiality');
  paragraph(
    d,
    "Each party may receive the other's non-public information (\"Confidential Information\"). The receiving party will use it only to perform under this Agreement, protect it with at least reasonable care, and not disclose it except to personnel and advisors with a need to know who are bound by similar obligations. These obligations continue for 3 years after disclosure (and for trade secrets, for as long as they remain trade secrets)."
  );
  d.y += 4;

  heading(d, '6. Data protection');
  paragraph(
    d,
    'Each party will comply with applicable data-protection laws. HeyVacay processes traveler personal data only to provide the services and under its Data Processing Addendum, applies industry-standard administrative, technical, and physical safeguards, and will notify Customer without undue delay on becoming aware of a confirmed breach of Customer personal data.'
  );
  d.y += 4;

  heading(d, '7. Warranties & disclaimer');
  paragraph(
    d,
    'HeyVacay warrants it will provide the services in a professional and workmanlike manner. Travel inventory is supplied by third-party airlines, hotels, and aggregators and is subject to their fare rules and availability; HeyVacay is not the supplier of travel and is not liable for supplier acts or omissions. EXCEPT AS EXPRESSLY STATED, THE SERVICES ARE PROVIDED "AS IS" AND HEYVACAY DISCLAIMS ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.'
  );
  d.y += 4;

  heading(d, '8. Limitation of liability');
  paragraph(
    d,
    "Neither party is liable for indirect, incidental, special, consequential, or punitive damages, or lost profits or revenue. Except for Customer's payment obligations, a party's breach of confidentiality, or a party's indemnification obligations, each party's total aggregate liability arising out of this Agreement will not exceed the fees paid or payable by Customer to HeyVacay in the 12 months preceding the event giving rise to the claim."
  );
  d.y += 4;

  heading(d, '9. Indemnification');
  paragraph(
    d,
    "Each party will defend and indemnify the other against third-party claims arising from its gross negligence, willful misconduct, or breach of this Agreement. Customer will additionally indemnify HeyVacay against claims arising from Customer's or its travelers' misuse of the platform or violation of supplier fare rules."
  );
  d.y += 4;

  heading(d, '10. General');
  paragraph(
    d,
    `This Agreement is governed by the laws of ${t.governingLaw}, without regard to its conflict-of-laws rules, and the parties submit to the exclusive jurisdiction of its courts. Neither party may assign this Agreement without the other's consent, except to a successor in a merger or sale of substantially all assets. Neither party is liable for delays caused by events beyond its reasonable control (force majeure). During the Term and for 12 months after, neither party will solicit for employment the other's personnel primarily involved in this Agreement. This Agreement, with its order forms and addenda, is the entire agreement between the parties and supersedes all prior discussions; any amendment must be in writing and signed by both parties. If any provision is unenforceable, the rest remains in effect.`
  );
  d.y += 14;

  heading(d, '11. Signatures');
  d.y += 10;
  const hvSig = ct.signatures?.heyvacay;
  const custSig = ct.signatures?.customer;
  signatureBlock(
    d,
    'HeyVacay, Inc.',
    hvSig?.name ?? ct.createdBy,
    hvSig ? `Account Executive · e-signed ${hvSig.date}` : 'Account Executive'
  );
  signatureBlock(
    d,
    c.name,
    custSig?.name ?? t.signerName,
    custSig ? `${t.signerTitle} · e-signed ${custSig.date}` : t.signerTitle
  );

  footer(d, `HeyVacay Enterprise · ${CONTRACT_TYPE_LABEL[t.type]} · ${c.name} · ${today()}`);
  d.pdf.save(`${slug(c.name)}-${t.type}-agreement.pdf`);
}

function signatureBlock(d: Doc, org: string, name: string, title: string) {
  ensureSpace(d, 72);
  d.pdf.setDrawColor(...LIGHT);
  d.pdf.setLineWidth(0.8);
  d.pdf.line(MARGIN, d.y, MARGIN + 220, d.y);
  d.pdf.setFont('helvetica', 'bold');
  d.pdf.setFontSize(11);
  d.pdf.setTextColor(...NAVY);
  d.pdf.text(name || ' ', MARGIN, d.y + 16);
  d.pdf.setFont('helvetica', 'normal');
  d.pdf.setFontSize(9);
  d.pdf.setTextColor(...SLATE);
  d.pdf.text(`${title} · ${org}`, MARGIN, d.y + 30);
  d.y += 56;
}

/* ---------------- pipeline report ---------------- */

export function pipelineReportPdf(companies: SalesCompany[], rep: string) {
  const d = newDoc();
  brandHeader(d, 'Pipeline report', rep);

  const deals = companies.flatMap((c) => c.deals);
  paragraph(d, `Book of business as of ${today()}.`, { color: LIGHT });
  d.y += 8;

  heading(d, 'Summary');
  kvGrid(d, [
    ['Accounts', String(companies.length)],
    ['Open pipeline', money(openPipeline(deals))],
    ['Weighted forecast', money(Math.round(weightedPipeline(deals)))],
    ['Closed won (ACV)', money(wonValue(deals))],
    ['Win rate', `${winRate(deals)}%`],
    ['Spend under mgmt', money(
      companies
        .filter((c) => c.status === 'active' || c.status === 'onboarding')
        .reduce((s, c) => s + c.annualSpend, 0)
    )],
  ]);

  heading(d, 'Accounts');
  companies.forEach((c) => {
    ensureSpace(d, 30);
    d.pdf.setFont('helvetica', 'bold');
    d.pdf.setFontSize(10);
    d.pdf.setTextColor(...NAVY);
    d.pdf.text(c.name, MARGIN, d.y);
    d.pdf.setFont('helvetica', 'normal');
    d.pdf.setTextColor(...SLATE);
    d.pdf.text(
      `${STATUS_LABEL[c.status]} · ${money(c.annualSpend)}/yr · health ${c.health}`,
      PAGE_W - MARGIN,
      d.y,
      { align: 'right' }
    );
    d.y += 16;
  });

  footer(d, `HeyVacay Enterprise · Pipeline report · ${rep} · ${today()}`);
  d.pdf.save(`pipeline-report-${slug(rep)}.pdf`);
}

/* ---------------- savings report ---------------- */

const EMER: [number, number, number] = [5, 150, 105];
const RED: [number, number, number] = [220, 38, 38];

export interface SavingsReportData {
  companyName: string;
  generatedFor?: string;
  customerSince?: string;
  history: { month: string; spend: number; savings: number }[];
  byDept: { label: string; spend: number; savings: number }[];
  topSavers: { name: string; savings: number; trips: number }[];
}

export function savingsReportPdf(data: SavingsReportData) {
  const d = newDoc();
  brandHeader(d, 'Savings report', data.companyName);

  const months = data.history;
  const totalSaved = months.reduce((s, h) => s + h.savings, 0);
  const totalSpend = months.reduce((s, h) => s + h.spend, 0);
  const belowPct =
    totalSpend + totalSaved > 0
      ? Math.round((totalSaved / (totalSpend + totalSaved)) * 100)
      : 0;
  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  const momDelta = last && prev ? last.savings - prev.savings : 0;
  const momPct = prev && prev.savings > 0 ? Math.round((momDelta / prev.savings) * 100) : null;

  // Year-over-year once there are at least two years of history.
  const hasYear = months.length >= 24;
  const last12 = months.slice(-12).reduce((s, h) => s + h.savings, 0);
  const prior12 = months.slice(-24, -12).reduce((s, h) => s + h.savings, 0);
  const yoyDelta = last12 - prior12;
  const yoyPct = prior12 > 0 ? Math.round((yoyDelta / prior12) * 100) : null;

  paragraph(
    d,
    `${data.generatedFor ? `Prepared for ${data.generatedFor} · ` : ''}${
      data.customerSince ? `Customer since ${data.customerSince} · ` : ''
    }Generated ${today()}`,
    { size: 10, color: LIGHT }
  );
  d.y += 10;

  // Hero — total saved.
  ensureSpace(d, 120);
  d.pdf.setFillColor(...NAVY);
  d.pdf.roundedRect(MARGIN, d.y, CONTENT_W, 104, 12, 12, 'F');
  d.pdf.setTextColor(...BRAND);
  d.pdf.setFont('helvetica', 'bold');
  d.pdf.setFontSize(9);
  d.pdf.text('TOTAL SAVED WITH HEYVACAY', MARGIN + 24, d.y + 30);
  d.pdf.setTextColor(255, 255, 255);
  d.pdf.setFontSize(40);
  d.pdf.text(money(totalSaved), MARGIN + 24, d.y + 70);
  d.pdf.setFont('helvetica', 'normal');
  d.pdf.setFontSize(10);
  d.pdf.setTextColor(200, 230, 236);
  d.pdf.text(
    `${belowPct}% below market across ${money(totalSpend)} of managed travel`,
    MARGIN + 24,
    d.y + 90
  );
  d.y += 124;

  // Stat tiles — MoM and YoY (or lifetime when not a full year yet).
  const tiles: { label: string; value: string; delta?: string; good?: boolean }[] = [
    {
      label: 'Saved this month',
      value: last ? money(last.savings) : '—',
      delta:
        prev != null
          ? `${momDelta >= 0 ? '▲' : '▼'} ${money(Math.abs(momDelta))}${
              momPct != null ? ` (${momPct >= 0 ? '+' : ''}${momPct}%)` : ''
            } vs last month`
          : undefined,
      good: momDelta >= 0,
    },
    hasYear
      ? {
          label: 'Saved this year',
          value: money(last12),
          delta:
            prior12 > 0
              ? `${yoyDelta >= 0 ? '▲' : '▼'} ${money(Math.abs(yoyDelta))}${
                  yoyPct != null ? ` (${yoyPct >= 0 ? '+' : ''}${yoyPct}%)` : ''
                } vs last year`
              : undefined,
          good: yoyDelta >= 0,
        }
      : {
          label: `Saved over ${months.length} months`,
          value: money(totalSaved),
          delta: 'Full-year comparison unlocks at 12 months',
        },
    { label: 'Below market', value: `${belowPct}%`, delta: 'Blended across all trips' },
  ];
  const tileW = (CONTENT_W - 2 * 12) / 3;
  ensureSpace(d, 86);
  tiles.forEach((t, i) => {
    const x = MARGIN + i * (tileW + 12);
    d.pdf.setFillColor(247, 250, 252);
    d.pdf.roundedRect(x, d.y, tileW, 78, 10, 10, 'F');
    d.pdf.setFont('helvetica', 'normal');
    d.pdf.setFontSize(8);
    d.pdf.setTextColor(...LIGHT);
    d.pdf.text(t.label.toUpperCase(), x + 14, d.y + 20);
    d.pdf.setFont('helvetica', 'bold');
    d.pdf.setFontSize(18);
    d.pdf.setTextColor(...NAVY);
    d.pdf.text(t.value, x + 14, d.y + 44);
    if (t.delta) {
      d.pdf.setFont('helvetica', 'normal');
      d.pdf.setFontSize(7.5);
      d.pdf.setTextColor(...(t.good === undefined ? LIGHT : t.good ? EMER : RED));
      const dl = d.pdf.splitTextToSize(t.delta, tileW - 22) as string[];
      dl.slice(0, 2).forEach((ln, li) => d.pdf.text(ln, x + 14, d.y + 60 + li * 10));
    }
  });
  d.y += 98;

  // Monthly savings bar chart.
  if (months.length) {
    heading(d, 'Savings by month');
    const chartH = 120;
    ensureSpace(d, chartH + 24);
    const maxSav = Math.max(1, ...months.map((m) => m.savings));
    const gap = 10;
    const barW = (CONTENT_W - gap * (months.length - 1)) / months.length;
    const baseY = d.y + chartH;
    months.forEach((m, i) => {
      const h = Math.max(2, (m.savings / maxSav) * (chartH - 20));
      const x = MARGIN + i * (barW + gap);
      d.pdf.setFillColor(...BRAND);
      d.pdf.roundedRect(x, baseY - h, barW, h, 3, 3, 'F');
      d.pdf.setFont('helvetica', 'bold');
      d.pdf.setFontSize(7);
      d.pdf.setTextColor(...NAVY);
      d.pdf.text(money(m.savings), x + barW / 2, baseY - h - 5, { align: 'center' });
      d.pdf.setFont('helvetica', 'normal');
      d.pdf.setTextColor(...LIGHT);
      d.pdf.text(m.month, x + barW / 2, baseY + 12, { align: 'center' });
    });
    d.y = baseY + 28;
  }

  // Department breakdown.
  if (data.byDept.length) {
    heading(d, 'Savings by department');
    data.byDept
      .slice()
      .sort((a, b) => b.savings - a.savings)
      .forEach((dep) => {
        ensureSpace(d, 18);
        d.pdf.setFont('helvetica', 'bold');
        d.pdf.setFontSize(10);
        d.pdf.setTextColor(...NAVY);
        d.pdf.text(dep.label, MARGIN, d.y);
        d.pdf.setFont('helvetica', 'normal');
        d.pdf.setTextColor(...EMER);
        d.pdf.text(`saved ${money(dep.savings)}`, PAGE_W - MARGIN, d.y, { align: 'right' });
        d.pdf.setTextColor(...LIGHT);
        d.pdf.setFontSize(8);
        d.pdf.text(`${money(dep.spend)} spend`, PAGE_W - MARGIN - 120, d.y, { align: 'right' });
        d.y += 18;
      });
    d.y += 6;
  }

  // Top savers.
  if (data.topSavers.length) {
    heading(d, 'Top savers');
    data.topSavers.slice(0, 6).forEach((p, i) =>
      bullet(d, `${i + 1}. ${p.name} — saved ${money(p.savings)} across ${p.trips} trip${p.trips === 1 ? '' : 's'}`)
    );
  }

  footer(d, `HeyVacay Enterprise · Savings report · ${data.companyName} · ${today()}`);
  d.pdf.save(`${slug(data.companyName)}-savings-report.pdf`);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

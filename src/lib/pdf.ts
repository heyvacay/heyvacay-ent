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

  pdf.setTextColor(...BRAND);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('HEYVACAY ENTERPRISE', MARGIN, 40);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(kicker.toUpperCase(), MARGIN, 56);

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

  heading(d, '2. Scope of services');
  paragraph(
    d,
    'HeyVacay will provide Customer access to its corporate travel and expense platform, including flight and hotel booking, policy controls, budgets, approvals, expense management, and savings rewards. HeyVacay sources inventory from its supply partners and passes negotiated rates through to Customer.'
  );
  d.y += 6;

  heading(d, '3. Support');
  paragraph(
    d,
    `Customer will receive ${t.supportTier} support. Dedicated and Priority tiers include a named account manager and defined response-time targets. All tiers include self-service help and in-app assistance.`
  );
  d.y += 6;

  heading(d, '4. Term & renewal');
  paragraph(
    d,
    `This Agreement begins on ${t.startDate} and continues for ${t.termMonths} months. ${
      t.autoRenew
        ? 'It renews automatically for successive like terms unless either party gives notice at least 30 days before the end of the then-current term.'
        : 'It does not renew automatically; renewal requires a new written order.'
    }`
  );
  d.y += 6;

  heading(d, '5. Governing law');
  paragraph(d, `This Agreement is governed by the laws of ${t.governingLaw}, without regard to its conflict-of-laws rules.`);
  d.y += 14;

  heading(d, '6. Signatures');
  d.y += 10;
  signatureBlock(d, 'HeyVacay, Inc.', ct.createdBy, 'Account Executive');
  signatureBlock(d, c.name, t.signerName, t.signerTitle);

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

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

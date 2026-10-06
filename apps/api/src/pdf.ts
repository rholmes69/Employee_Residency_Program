import PDFDocument from 'pdfkit';
import type { Writable } from 'node:stream';
import { ACKNOWLEDGMENT, INTEREST_AREAS, QUESTIONS, REASONS, STATUS_LABELS, type ApplicationStatus } from '@erp/shared';

type AppForPdf = {
  status: string;
  fullName: string;
  jobTitle: string;
  department: string;
  supervisorName: string;
  supervisorEmail: string;
  lengthOfEmployment: string;
  email: string;
  phone: string;
  reasons: string[];
  reasonOther: string | null;
  hopeToGain: string;
  interestAreas: string[];
  interestOther: string | null;
  goals: string;
  strengths: string;
  willingToParticipate: boolean | null;
  signatureName: string | null;
  signedAt: Date | null;
  submittedAt: Date | null;
  supervisorReview?: { decision: string; comment: string | null; decidedAt: Date } | null;
};

const NAVY = '#1e3a8a';
const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' }) : '';

/** Renders the application in the same layout as the paper form. */
export function renderApplicationPdf(app: AppForPdf, out: Writable) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 60, info: { Title: `Residency Application — ${app.fullName}` } });
  doc.pipe(out);
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  doc.fillColor(NAVY).font('Times-Bold').fontSize(22).text('DELTA HEALTH CENTER', { align: 'left' });
  doc.moveDown(0.6);
  doc.fillColor('black').font('Helvetica-Bold').fontSize(14).text('Employee Residency Program Application', { align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor('#555')
    .text(`Status: ${STATUS_LABELS[app.status as ApplicationStatus] ?? app.status}   ·   Submitted: ${fmt(app.submittedAt) || '—'}`, { align: 'center' });
  doc.moveDown(1).fillColor('black');

  const heading = (t: string) => {
    doc.moveDown(0.6).font('Helvetica-Bold').fontSize(12).fillColor(NAVY).text(t).fillColor('black').moveDown(0.3);
  };
  const field = (label: string, value: string) => {
    doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true }).font('Helvetica').text(value || '—');
    doc.moveDown(0.2);
  };
  const checkbox = (checked: boolean, label: string) => {
    if (doc.y > doc.page.height - 90) doc.addPage();
    const y = doc.y + 1;
    doc.rect(left + 4, y, 9, 9).lineWidth(0.8).stroke();
    if (checked) doc.moveTo(left + 5.5, y + 1.5).lineTo(left + 11.5, y + 7.5).moveTo(left + 11.5, y + 1.5).lineTo(left + 5.5, y + 7.5).stroke();
    doc.font('Helvetica').fontSize(10).text(label, left + 20, y - 1, { width: width - 20 });
    doc.x = left;
    doc.moveDown(0.15);
  };
  const answer = (q: string, a: string) => {
    doc.moveDown(0.4).font('Helvetica-Bold').fontSize(10).text(q, { width });
    doc.moveDown(0.2).font('Helvetica').fontSize(10).text(a || '—', { width, align: 'left' });
  };

  heading('Employee Information');
  field('Name', app.fullName);
  field('Current Job Title', app.jobTitle);
  field('Department/Clinic', app.department);
  field('Immediate Supervisor', `${app.supervisorName}${app.supervisorEmail ? ` <${app.supervisorEmail}>` : ''}`);
  field('Length of Employment with Delta Health Center', app.lengthOfEmployment);
  field('Email', app.email);
  field('Phone', app.phone);

  heading('Professional Growth & Interests');
  doc.font('Helvetica-Bold').fontSize(10).text(`${QUESTIONS.reasons} Please select all that apply:`, { width });
  doc.moveDown(0.3);
  for (const r of REASONS)
    checkbox(app.reasons.includes(r.value), r.value === 'OTHER' ? `Other: ${app.reasonOther ?? ''}` : r.label);

  answer(QUESTIONS.hopeToGain, app.hopeToGain);

  doc.moveDown(0.5).font('Helvetica-Bold').fontSize(10).text(`${QUESTIONS.interestAreas} Please select all that apply:`, { width });
  doc.moveDown(0.3);
  for (const a of INTEREST_AREAS)
    checkbox(app.interestAreas.includes(a.value), a.value === 'OTHER' ? `Other: ${app.interestOther ?? ''}` : a.label);

  answer(QUESTIONS.goals, app.goals);
  answer(QUESTIONS.strengths, app.strengths);

  doc.moveDown(0.4).font('Helvetica-Bold').fontSize(10).text(QUESTIONS.willingToParticipate, { width });
  doc.moveDown(0.3);
  checkbox(app.willingToParticipate === true, 'Yes');
  checkbox(app.willingToParticipate === false, 'No');

  heading('Employee Acknowledgment');
  doc.font('Helvetica').fontSize(10).text(ACKNOWLEDGMENT, { width });
  doc.moveDown(0.6);
  field('Employee Signature (typed)', app.signatureName ?? '');
  field('Date', fmt(app.signedAt));

  if (app.supervisorReview) {
    heading('Supervisor Sign-off');
    field('Decision', app.supervisorReview.decision === 'APPROVED' ? 'Approved' : 'Declined');
    field('Date', fmt(app.supervisorReview.decidedAt));
    if (app.supervisorReview.comment) field('Comment', app.supervisorReview.comment);
  }

  doc.end();
}

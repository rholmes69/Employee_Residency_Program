import nodemailer, { type Transporter } from 'nodemailer';
import { STATUS_LABELS, type ApplicationStatus } from '@erp/shared';
import { config } from './config';

let transporter: Transporter | null = null;

function getTransporter() {
  if (!config.smtp.host) return null;
  transporter ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter;
}

/** Never throws — email failures must not block the application workflow. */
export async function sendMail(to: string | string[], subject: string, text: string) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return;
  const t = getTransporter();
  if (!t) {
    console.log(`[mail:disabled] to=${recipients.join(',')} subject="${subject}"`);
    return;
  }
  try {
    await t.sendMail({ from: config.smtp.from, to: recipients, subject, text });
  } catch (e) {
    console.error('[mail] send failed', e);
  }
}

const link = (path: string) => `${config.appUrl}${path}`;
const sig = '\n\n— Delta Health Center Employee Residency Program';

type AppLike = { id: string; fullName: string; email: string; supervisorName: string; supervisorEmail: string };

export const emails = {
  submitted: (a: AppLike) =>
    sendMail(
      a.email,
      'We received your Employee Residency Program application',
      `Hi ${a.fullName},\n\nThank you for applying to the Employee Residency Program. Your application has been sent to your supervisor, ${a.supervisorName}, for sign-off. After that, HR will review it.\n\nTrack your status: ${link('/application')}${sig}`,
    ),

  supervisorRequest: (a: AppLike) =>
    sendMail(
      a.supervisorEmail,
      `Sign-off requested: ${a.fullName} — Employee Residency Program`,
      `Hello ${a.supervisorName},\n\n${a.fullName} has applied to the Employee Residency Program and listed you as their immediate supervisor. Please review and approve or decline the application:\n\n${link(`/supervisor/${a.id}`)}\n\nSign in with your Delta Health Center Microsoft account.${sig}`,
    ),

  supervisorDecided: (a: AppLike, approved: boolean, comment?: string | null) =>
    Promise.all([
      sendMail(
        a.email,
        `Supervisor ${approved ? 'approved' : 'declined'} your residency application`,
        `Hi ${a.fullName},\n\n${a.supervisorName} has ${approved ? 'approved' : 'declined'} your Employee Residency Program application.${comment ? `\n\nComment: ${comment}` : ''}\n\n${approved ? 'Your application is now with HR for review.' : 'You may talk with your supervisor, update your application, and resubmit before the deadline.'}\n\n${link('/application')}${sig}`,
      ),
      approved && config.hrNotifyEmail
        ? sendMail(
            config.hrNotifyEmail,
            `New residency application ready for review: ${a.fullName}`,
            `${a.fullName}'s application has supervisor sign-off and is ready for HR review.\n\n${link(`/review/${a.id}`)}${sig}`,
          )
        : Promise.resolve(),
    ]),

  decision: (a: AppLike, status: ApplicationStatus, note?: string | null) =>
    sendMail(
      a.email,
      `Employee Residency Program application update: ${STATUS_LABELS[status]}`,
      `Hi ${a.fullName},\n\nYour Employee Residency Program application status is now: ${STATUS_LABELS[status]}.${note ? `\n\n${note}` : ''}\n\n${link('/application')}${sig}`,
    ),
};

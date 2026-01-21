const nodemailer = require('nodemailer');

const topicPreferenceMap = {
  task_assigned: ['email_task_assigned', 'notify_task_assigned'],
  task_completed: ['email_task_completed', 'notify_task_completed'],
  task_deadline: ['email_task_due_soon', 'notify_task_deadline'],
  task_overdue: ['email_task_overdue', 'notify_task_deadline'],
  approval_request: ['email_approval_request', 'notify_approval_request'],
  approval_result: ['email_approval_result', 'notify_approval_result'],
  invoice: ['notify_invoice'],
  payment: ['notify_payment'],
  matter: ['notify_matter']
};

const topicSubjectMap = {
  task_assigned: 'Task assigned',
  task_completed: 'Task completed',
  task_deadline: 'Task deadline',
  approval_request: 'Approval requested',
  approval_result: 'Approval result',
  invoice: 'Invoice created',
  payment: 'Payment received',
  matter: 'Matter update'
};

const notifications = {
  taskAssigned: (title, assigneeName, dueDate) => {
    const due = dueDate ? `, due ${new Date(dueDate).toLocaleDateString()}` : '';
    return `You have a new task: ${title}${due}.
Assigned to: ${assigneeName}.`;
  },
  taskCompleted: (title, creatorName) => `Task completed: ${title}.
Marked by: ${creatorName}.`,
  costJournalPendingApproval: (description, amount, requester, approver) => {
    const formattedAmount = Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    return `Approval requested for cost journal.
Item: ${description} (${formattedAmount}).
Requested by: ${requester} -> Approver: ${approver}.`;
  },
  costJournalApproved: (description, approver, requester) =>
    `Approval result: APPROVED.
Item: ${description}.
Approved by: ${approver} -> Notified: ${requester}.`,
  costJournalRejected: (description, approver, requester, reason) => {
    const why = reason ? `Reason: ${reason}` : 'No reason provided.';
    return `Approval result: REJECTED.
Item: ${description}.
By: ${approver} -> Notified: ${requester}.
${why}`;
  },
  invoiceCreated: (invoiceNumber, clientName, amount, attorneyName) => {
    const formattedAmount = Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    return `Invoice created: ${invoiceNumber}.
Client: ${clientName}.
Total: ${formattedAmount}.
Responsible attorney: ${attorneyName}.`;
  }
};

let emailTransport = null;
let lastEmailError = null;
const FIRM_NAME = 'Pro Alliance Law Firm';
const RAW_BASE_URL = (process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
const DEFAULT_BASE_URL = RAW_BASE_URL || 'http://localhost:3000';

const EMAIL_USERNAME = (process.env.EMAIL_USERNAME || '').trim();
const EMAIL_PASSWORD = ((process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD || '')).trim();
const EMAIL_FROM = (process.env.EMAIL_FROM || EMAIL_USERNAME).trim();

const logEmail = (level, message, meta = {}) => {
  const logger = console[level] || console.log;
  logger('[Email]', message, meta);
};

const getEmailTransport = () => {
  if (emailTransport) return emailTransport;
  if (!EMAIL_USERNAME || !EMAIL_PASSWORD) {
    lastEmailError = 'Email credentials missing (set EMAIL_USERNAME and EMAIL_APP_PASSWORD/EMAIL_PASSWORD)';
    logEmail('warn', lastEmailError);
    return null;
  }

  emailTransport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USERNAME,
      pass: EMAIL_PASSWORD
    }
  });

  return emailTransport;
};

const resolvePreference = (user, prefKeyOrList) => {
  const keys = Array.isArray(prefKeyOrList) ? prefKeyOrList : [prefKeyOrList];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(user, key)) {
      return user[key] !== false;
    }
  }
  return true;
};

const buildLink = (link) => {
  if (!link) return DEFAULT_BASE_URL;
  if (link.startsWith('http://') || link.startsWith('https://')) return link;
  const normalized = link.startsWith('/') ? link : `/${link}`;
  return `${DEFAULT_BASE_URL}${normalized}`;
};

const sendEmailNotification = async ({ email = null, subject = null, message, user = null, topic = null, link = null }) => {
  try {
    const to = email || user?.email;
    if (!to) {
      logEmail('warn', 'Send blocked: missing recipient email', { topic, userId: user?.id });
      return { success: false, message: 'Recipient email missing' };
    }

    const prefKey = topicPreferenceMap[topic];
    if (prefKey && user && !resolvePreference(user, prefKey)) {
      logEmail('warn', 'Send blocked: recipient disabled topic', { topic, userId: user.id });
      return { success: false, message: 'Recipient disabled this notification type' };
    }

    const transport = getEmailTransport();
    if (!transport) {
      return { success: false, message: lastEmailError || 'Email transport not configured' };
    }

    const finalSubjectCore = subject || topicSubjectMap[topic] || 'Notification';
    const finalSubject = `${FIRM_NAME} - ${finalSubjectCore}`;

    const linkUrl = buildLink(link);
    const bodyLines = [
      `${FIRM_NAME}`,
      '',
      message,
      '',
      `Buka detail: ${linkUrl}`,
      '',
      `Terima kasih,`,
      `${FIRM_NAME}`
    ];

    await transport.sendMail({
      from: EMAIL_FROM,
      to,
      subject: finalSubject,
      text: bodyLines.join('\n')
    });

    logEmail('info', 'Email sent', { topic, userId: user?.id, email: to });
    return { success: true, message: 'Email sent', to };
  } catch (err) {
    lastEmailError = err?.message;
    logEmail('error', 'Email send failed', { topic, userId: user?.id, error: err?.message });
    return { success: false, message: err?.message || 'Email send failed' };
  }
};

const sendNotification = (args) => sendEmailNotification(args);

module.exports = {
  sendEmailNotification,
  sendNotification,
  notifications
};

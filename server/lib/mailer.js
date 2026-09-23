const nodemailer = require('nodemailer');
const path = require('path');
const { escapeHtml } = require('./text');

function transporter({ service, host, port, user, pass }) {
  if (!user || !pass) throw new Error('Configure ton compte e-mail dans Réglages.');
  const auth = { user, pass: pass.replace(/\s+/g, '') };
  if (service && service !== 'custom') return nodemailer.createTransport({ service, auth });
  return nodemailer.createTransport({ host, port: Number(port) || 465, secure: Number(port) !== 587, auth });
}

function textToHtml(text) {
  return String(text)
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function send(smtp, { fromName, to, subject, body, attachment }) {
  const t = transporter(smtp);
  const info = await t.sendMail({
    from: fromName ? `"${fromName.replace(/"/g, '')}" <${smtp.user}>` : smtp.user,
    to,
    subject,
    text: body,
    html: `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1d1d1f">${textToHtml(body)}</div>`,
    attachments: attachment ? [{ filename: path.basename(attachment), path: attachment }] : [],
  });
  return info.messageId;
}

async function verify(smtp) {
  await transporter(smtp).verify();
}

module.exports = { send, verify };

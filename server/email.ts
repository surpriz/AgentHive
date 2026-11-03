/** One transactional email. Plain text first; the HTML is the same message with a link. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export type MailSender = (mail: Mail) => Promise<void>;

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The HTML body is the plain text with links made clickable; the text is the source of truth. */
const htmlOf = (text: string) => `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text).replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</pre>`;

/** Sends through Resend's HTTP API. No SDK: one POST, one key, nothing else to keep up to date. */
export function resendSender(opts: { apiKey: string; from: string; fetchImpl?: typeof fetch }): MailSender {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return async (mail) => {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: opts.from, to: [mail.to], subject: mail.subject, text: mail.text, html: htmlOf(mail.text) }),
    });
    if (!res.ok) throw new Error(`email not sent (${res.status})`);
  };
}

/**
 * Sends through Amazon SES (v2 API). Credentials are explicit on purpose: the Vercel function runs on
 * Lambda with its own ambient AWS role, and the default credential chain would pick that one up.
 */
export function sesSender(opts: {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  from: string;
  client?: { send(command: SendEmailCommand): Promise<unknown> };
}): MailSender {
  const client =
    opts.client ??
    new SESv2Client({ region: opts.region, credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey } });
  return async (mail) => {
    try {
      await client.send(
        new SendEmailCommand({
          FromEmailAddress: opts.from,
          Destination: { ToAddresses: [mail.to] },
          Content: {
            Simple: {
              Subject: { Data: mail.subject, Charset: 'UTF-8' },
              Body: { Text: { Data: mail.text, Charset: 'UTF-8' }, Html: { Data: htmlOf(mail.text), Charset: 'UTF-8' } },
            },
          },
        }),
      );
    } catch (err) {
      throw new Error(`email not sent (${err instanceof Error ? err.name : 'ses'})`);
    }
  };
}

export const verificationMail = (to: string, url: string): Mail => ({
  to,
  subject: 'Confirm your AgentHive account',
  text: `Confirm your email to finish creating your AgentHive account:\n\n${url}\n\nThe link works once and expires in an hour. If you did not sign up, ignore this message.`,
});

export const resetMail = (to: string, url: string): Mail => ({
  to,
  subject: 'Reset your AgentHive password',
  text: `Someone asked to reset the password of this AgentHive account:\n\n${url}\n\nThe link works once and expires in an hour. If that was not you, ignore this message and nothing changes.`,
});

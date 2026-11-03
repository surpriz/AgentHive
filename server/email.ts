/** One transactional email. Plain text first; the HTML is the same message with a link. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export type MailSender = (mail: Mail) => Promise<void>;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Sends through Resend's HTTP API. No SDK: one POST, one key, nothing else to keep up to date. */
export function resendSender(opts: { apiKey: string; from: string; fetchImpl?: typeof fetch }): MailSender {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return async (mail) => {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: opts.from, to: [mail.to], subject: mail.subject, text: mail.text, html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(mail.text).replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</pre>` }),
    });
    if (!res.ok) throw new Error(`email not sent (${res.status})`);
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

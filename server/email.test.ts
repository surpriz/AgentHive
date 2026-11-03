import { describe, expect, it } from 'vitest';
import { resendSender, sesSender, verificationMail } from './email';
import { mailSenderFromEnv } from './env';

describe('mail senders', () => {
  it('ses: sends text and html with the configured sender', async () => {
    const sent: unknown[] = [];
    const send = sesSender({
      region: 'eu-west-1',
      accessKeyId: 'AKIA',
      secretAccessKey: 's',
      from: 'AgentHive <hello@agenthive.sh>',
      client: { send: async (cmd) => void sent.push(cmd.input) },
    });
    await send(verificationMail('jane@example.com', 'https://agenthive.sh/v?x=1&y=2'));
    expect(sent).toHaveLength(1);
    const input = sent[0] as { FromEmailAddress: string; Destination: { ToAddresses: string[] }; Content: { Simple: { Subject: { Data: string }; Body: { Text: { Data: string }; Html: { Data: string } } } } };
    expect(input.FromEmailAddress).toBe('AgentHive <hello@agenthive.sh>');
    expect(input.Destination.ToAddresses).toEqual(['jane@example.com']);
    expect(input.Content.Simple.Subject.Data).toBe('Confirm your AgentHive account');
    expect(input.Content.Simple.Body.Text.Data).toContain('https://agenthive.sh/v?x=1&y=2');
    expect(input.Content.Simple.Body.Html.Data).toContain('<a href="https://agenthive.sh/v?x=1&amp;y=2">');
  });

  it('ses: wraps provider errors without leaking them', async () => {
    const send = sesSender({ region: 'r', accessKeyId: 'a', secretAccessKey: 's', from: 'x@y.z', client: { send: async () => { const e = new Error('boom'); e.name = 'MessageRejected'; throw e; } } });
    await expect(send(verificationMail('a@b.c', 'https://x'))).rejects.toThrow('email not sent (MessageRejected)');
  });

  it('resend: posts to the API with a bearer token', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init: init! }); return new Response('{}', { status: 200 }); }) as typeof fetch;
    await resendSender({ apiKey: 'k', from: 'x@y.z', fetchImpl })(verificationMail('a@b.c', 'https://x'));
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer k');
  });

  it('env: SES wins over Resend, nothing without EMAIL_FROM', () => {
    expect(mailSenderFromEnv({})).toBeUndefined();
    expect(mailSenderFromEnv({ RESEND_API_KEY: 'k' })).toBeUndefined();
    expect(mailSenderFromEnv({ RESEND_API_KEY: 'k', EMAIL_FROM: 'x@y.z' })).toBeTypeOf('function');
    expect(mailSenderFromEnv({ SES_REGION: 'eu-west-1', SES_ACCESS_KEY_ID: 'a', SES_SECRET_ACCESS_KEY: 's', EMAIL_FROM: 'x@y.z' })).toBeTypeOf('function');
    expect(mailSenderFromEnv({ SES_REGION: 'eu-west-1', EMAIL_FROM: 'x@y.z' })).toBeUndefined();
  });
});

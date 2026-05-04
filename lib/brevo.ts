import { env } from '@/lib/env';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export async function sendEmail(
  toEmail: string,
  subject: string,
  body: string,
  toName: string = '',
): Promise<true> {
  if (!env.BREVO_API_KEY) {
    throw new Error(
      'BREVO_API_KEY is not set. Sign up free at https://app.brevo.com and add the key to .env.local',
    );
  }
  if (!env.SENDER_EMAIL) {
    throw new Error('SENDER_EMAIL is not set in .env.local');
  }

  const payload = {
    sender: { name: env.CLUB_NAME, email: env.SENDER_EMAIL },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    textContent: body,
  };

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': env.BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo error ${res.status}: ${text}`);
  }
  return true;
}

export function isEmailConfigured(): boolean {
  return Boolean(env.BREVO_API_KEY && env.SENDER_EMAIL);
}

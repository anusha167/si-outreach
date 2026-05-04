import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse, server } from '@tests/helpers/msw';

const BREVO = 'https://api.brevo.com/v3/smtp/email';

describe('brevo.sendEmail', () => {
  beforeEach(() => {
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.SENDER_EMAIL = 'sender@test.com';
  });
  afterEach(() => {
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.SENDER_EMAIL = 'sender@test.com';
  });

  it('sends a Brevo-shaped payload', async () => {
    let captured: unknown = null;
    server.use(
      http.post(BREVO, async ({ request }: { request: Request }) => {
        captured = await request.json();
        return HttpResponse.json({ messageId: 'abc' }, { status: 201 });
      }),
    );
    const { sendEmail } = await import('@/lib/brevo');
    const ok = await sendEmail('to@x.com', 'Hi', 'Hello world', 'Jane');
    expect(ok).toBe(true);
    const body = captured as Record<string, unknown>;
    expect(body.subject).toBe('Hi');
    expect(body.textContent).toBe('Hello world');
    const to = (body.to as { email: string; name: string }[])[0]!;
    expect(to.email).toBe('to@x.com');
    expect(to.name).toBe('Jane');
  });

  it('throws when Brevo returns non-200', async () => {
    server.use(
      http.post(BREVO, () => HttpResponse.json({ message: 'unauthorized' }, { status: 401 })),
    );
    const { sendEmail } = await import('@/lib/brevo');
    await expect(sendEmail('to@x.com', 's', 'b', '')).rejects.toThrow(/Brevo error 401/);
  });

  it('isEmailConfigured tracks env vars', async () => {
    const { isEmailConfigured } = await import('@/lib/brevo');
    expect(isEmailConfigured()).toBe(true);
  });
});

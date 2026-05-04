import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse, server } from '@tests/helpers/msw';
import { mockSupabase } from '@tests/helpers/route';
import type { Outreach } from '@/types/database';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = { id: userId, email: 'a@x.com', name: 'A', role: 'P', created_at: '' };

describe('POST /api/send/[id]', () => {
  beforeEach(() => vi.resetModules());

  it('returns 404 when draft missing', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/send/[id]/route');
    const res = await POST(new Request('http://t'), { params: Promise.resolve({ id: '999' }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 when contact has no email', async () => {
    await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        contacts: [{ id: 1, name: 'NoEmail', email: null, company: null, title: null, linkedin_url: null, website: null, description: null, industry: null, location: null, source: null, added_at: '' }],
        outreach: [{ id: 1, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'draft', subject: 's', body: 'b', sent_at: null }],
      },
    });
    const { POST } = await import('@/app/api/send/[id]/route');
    const res = await POST(new Request('http://t'), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(400);
  });

  it('sends via Brevo and marks sent', async () => {
    server.use(
      http.post('https://api.brevo.com/v3/smtp/email', () => HttpResponse.json({ messageId: 'x' }, { status: 201 })),
    );
    const { fake } = await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        contacts: [{ id: 1, name: 'Jane', email: 'j@x.com', company: null, title: null, linkedin_url: null, website: null, description: null, industry: null, location: null, source: null, added_at: '' }],
        outreach: [{ id: 1, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'draft', subject: 's', body: 'b', sent_at: null }],
      },
    });
    const { POST } = await import('@/app/api/send/[id]/route');
    const res = await POST(new Request('http://t'), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    const row = (fake._db.outreach as Outreach[]).find((o) => o.id === 1);
    expect(row?.status).toBe('sent');
    expect(row?.sent_at).toBeTruthy();
  });

  it('returns 500 when Brevo errors', async () => {
    server.use(
      http.post('https://api.brevo.com/v3/smtp/email', () => HttpResponse.json({}, { status: 401 })),
    );
    await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        contacts: [{ id: 1, name: 'J', email: 'j@x.com', company: null, title: null, linkedin_url: null, website: null, description: null, industry: null, location: null, source: null, added_at: '' }],
        outreach: [{ id: 1, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'draft', subject: 's', body: 'b', sent_at: null }],
      },
    });
    const { POST } = await import('@/app/api/send/[id]/route');
    const res = await POST(new Request('http://t'), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/skip/[id]', () => {
  beforeEach(() => vi.resetModules());

  it('marks contact skipped and removes existing draft', async () => {
    const { fake } = await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        outreach: [{ id: 1, contact_id: 5, event_id: null, user_id: null, channel: 'email', status: 'draft', subject: 's', body: 'b', sent_at: null }],
      },
    });
    const { POST } = await import('@/app/api/skip/[id]/route');
    const res = await POST(new Request('http://t'), { params: Promise.resolve({ id: '5' }) });
    expect(res.status).toBe(200);
    const drafts = (fake._db.outreach as Outreach[]).filter((o) => o.status === 'draft' && o.contact_id === 5);
    expect(drafts).toHaveLength(0);
    const skipped = (fake._db.outreach as Outreach[]).filter((o) => o.status === 'skipped' && o.contact_id === 5);
    expect(skipped).toHaveLength(1);
  });
});

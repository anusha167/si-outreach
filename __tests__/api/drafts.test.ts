import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse, server } from '@tests/helpers/msw';
import { mockSupabase, jsonRequest } from '@tests/helpers/route';
import type { Contact, Outreach } from '@/types/database';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = { id: userId, email: 'a@x.com', name: 'Anusha', role: 'President', created_at: '' };
const GEMINI_RE = /generativelanguage\.googleapis\.com\/v1beta\/models\/(.+)/;

const sampleContact: Contact = {
  id: 1,
  name: 'Jane',
  email: 'j@x.com',
  company: 'Acme',
  title: 'CEO',
  linkedin_url: '',
  website: '',
  description: '',
  industry: '',
  location: '',
  source: '',
  added_at: '',
};

describe('POST /api/draft/contact/[id]', () => {
  beforeEach(() => vi.resetModules());

  it('returns 404 when contact does not exist', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/draft/contact/[id]/route');
    const res = await POST(jsonRequest('http://t', {}), { params: Promise.resolve({ id: '999' }) });
    expect(res.status).toBe(404);
  });

  it('returns 409 if contact already sent', async () => {
    await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        contacts: [sampleContact],
        outreach: [{ id: 1, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'sent', subject: 's', body: 'b', sent_at: '2026-01-01' }],
      },
    });
    const { POST } = await import('@/app/api/draft/contact/[id]/route');
    const res = await POST(jsonRequest('http://t', {}), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(409);
  });

  it('creates a draft via template fallback when Gemini fails', async () => {
    server.use(http.post(GEMINI_RE, () => HttpResponse.json({}, { status: 500 })));
    const { fake } = await mockSupabase({
      authUser: { id: userId },
      db: { profiles: [profile], contacts: [sampleContact] },
    });
    const { POST } = await import('@/app/api/draft/contact/[id]/route');
    const res = await POST(jsonRequest('http://t', {}), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outreach_id).toBeDefined();
    expect(body.subject).toBeTruthy();
    expect(body.body).toContain('Anusha');
    const drafts = (fake._db.outreach as Outreach[]).filter((o) => o.status === 'draft');
    expect(drafts).toHaveLength(1);
  });

  it('redrafts on feedback path', async () => {
    server.use(
      http.post(GEMINI_RE, () =>
        HttpResponse.json({
          candidates: [{ content: { parts: [{ text: 'SUBJECT: Shorter\n---\nShorter body now.' }] } }],
        }),
      ),
    );
    await mockSupabase({
      authUser: { id: userId },
      db: { profiles: [profile], contacts: [sampleContact] },
    });
    const { POST } = await import('@/app/api/draft/contact/[id]/route');
    const res = await POST(
      jsonRequest('http://t', { feedback: 'shorter please', current_body: 'long body' }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subject).toBe('Shorter');
  });
});

describe('PUT/DELETE /api/draft/[id]', () => {
  beforeEach(() => vi.resetModules());

  it('PUT updates subject and body', async () => {
    const { fake } = await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        outreach: [{ id: 7, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'draft', subject: 'old', body: 'old', sent_at: null }],
      },
    });
    const { PUT } = await import('@/app/api/draft/[id]/route');
    const res = await PUT(jsonRequest('http://t', { subject: 'new', body: 'new body' }, 'PUT'), {
      params: Promise.resolve({ id: '7' }),
    });
    expect(res.status).toBe(200);
    const updated = (fake._db.outreach as Outreach[]).find((o) => o.id === 7);
    expect(updated?.subject).toBe('new');
    expect(updated?.body).toBe('new body');
  });

  it('DELETE removes a draft', async () => {
    const { fake } = await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        outreach: [{ id: 8, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'draft', subject: 's', body: 'b', sent_at: null }],
      },
    });
    const { DELETE } = await import('@/app/api/draft/[id]/route');
    const res = await DELETE(new Request('http://t'), { params: Promise.resolve({ id: '8' }) });
    expect(res.status).toBe(200);
    expect(fake._db.outreach).toHaveLength(0);
  });
});

describe('POST /api/draft/batch', () => {
  beforeEach(() => vi.resetModules());

  it('rejects empty contact_ids (400)', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/draft/batch/route');
    const res = await POST(jsonRequest('http://t', { contact_ids: [] }));
    expect(res.status).toBe(400);
  });

  it('rejects more than 5 ids (400)', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/draft/batch/route');
    const res = await POST(jsonRequest('http://t', { contact_ids: [1, 2, 3, 4, 5, 6] }));
    expect(res.status).toBe(400);
  });

  it('drafts in parallel and returns generated + errors lists', async () => {
    server.use(http.post(GEMINI_RE, () => HttpResponse.json({}, { status: 500 })));
    const c1 = { ...sampleContact, id: 1 };
    const c2 = { ...sampleContact, id: 2, name: 'Bob', email: 'b@x.com' };
    const c3 = { ...sampleContact, id: 3, name: 'Carl', email: 'c@x.com' };
    const { fake } = await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        contacts: [c1, c2, c3],
        outreach: [
          // c2 already sent
          { id: 99, contact_id: 2, event_id: null, user_id: null, channel: 'email', status: 'sent', subject: 's', body: 'b', sent_at: '2026-01-01' },
        ],
      },
    });
    const { POST } = await import('@/app/api/draft/batch/route');
    const res = await POST(jsonRequest('http://t', { contact_ids: [1, 2, 3, 999] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // c1 + c3 succeed, c2 already sent, 999 missing
    expect(body.generated).toHaveLength(2);
    expect(body.errors).toHaveLength(2);
    const drafts = (fake._db.outreach as Outreach[]).filter((o) => o.status === 'draft');
    expect(drafts).toHaveLength(2);
  });
});

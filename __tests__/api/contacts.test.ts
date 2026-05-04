import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase, jsonRequest } from '@tests/helpers/route';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = { id: userId, email: 'a@x.com', name: 'A', role: 'P', created_at: '' };

describe('contacts API', () => {
  beforeEach(() => vi.resetModules());

  it('GET 401 when unauthenticated', async () => {
    await mockSupabase({ authUser: null });
    const { GET } = await import('@/app/api/contacts/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('GET returns enriched contacts with last_sent + times_contacted', async () => {
    const c = { id: 1, name: 'Jane', email: 'j@x.com', company: 'Acme', title: '', linkedin_url: '', website: '', description: '', industry: '', location: '', source: '', added_at: '2026-01-01' };
    await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        contacts: [c],
        outreach: [
          { id: 1, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'sent', subject: 's', body: 'b', sent_at: '2026-04-01T10:00:00Z' },
          { id: 2, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'sent', subject: 's', body: 'b', sent_at: '2026-04-02T10:00:00Z' },
        ],
      },
    });
    const { GET } = await import('@/app/api/contacts/route');
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].times_contacted).toBe(2);
    expect(body[0].last_sent).toBe('2026-04-02T10:00:00Z');
  });

  it('POST requires name or email (400)', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/contacts/route');
    const res = await POST(jsonRequest('http://t/api/contacts', {}));
    expect(res.status).toBe(400);
  });

  it('POST creates a contact', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/contacts/route');
    const res = await POST(jsonRequest('http://t/api/contacts', {
      name: 'Jane',
      email: 'j@x.com',
      company: 'Acme',
      title: 'CEO',
      linkedin_url: 'li',
      website: 'web',
      description: 'desc',
      industry: 'Fintech',
      location: 'SF',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
  });

  it('POST 409 on duplicate email', async () => {
    const existing = { id: 1, name: 'A', email: 'dup@x.com', company: '', title: '', linkedin_url: '', website: '', description: '', industry: '', location: '', source: '', added_at: '' };
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile], contacts: [existing] } });
    const { POST } = await import('@/app/api/contacts/route');
    const res = await POST(jsonRequest('http://t/api/contacts', { name: 'B', email: 'dup@x.com' }));
    expect(res.status).toBe(409);
  });

  it('DELETE removes a contact', async () => {
    const c = { id: 7, name: 'Jane', email: 'j@x.com', company: '', title: '', linkedin_url: '', website: '', description: '', industry: '', location: '', source: '', added_at: '' };
    const { fake } = await mockSupabase({
      authUser: { id: userId },
      db: { profiles: [profile], contacts: [c] },
    });
    const { DELETE } = await import('@/app/api/contacts/[id]/route');
    const res = await DELETE(new Request('http://t'), { params: Promise.resolve({ id: '7' }) });
    expect(res.status).toBe(200);
    expect(fake._db.contacts).toHaveLength(0);
  });
});

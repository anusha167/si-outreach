import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from '@tests/helpers/route';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = { id: userId, email: 'a@x.com', name: 'A', role: 'P', created_at: '' };

describe('queue routes', () => {
  beforeEach(() => vi.resetModules());

  it('GET /api/queue 401 when unauthed', async () => {
    await mockSupabase({ authUser: null });
    const { GET } = await import('@/app/api/queue/route');
    expect((await GET()).status).toBe(401);
  });

  it('GET /api/queue/pending-ids returns only un-drafted, un-sent ids', async () => {
    await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        contacts: [
          { id: 1, name: 'A', email: null, company: null, title: null, linkedin_url: null, website: null, description: null, industry: null, location: null, source: null, added_at: '' },
          { id: 2, name: 'B', email: null, company: null, title: null, linkedin_url: null, website: null, description: null, industry: null, location: null, source: null, added_at: '' },
          { id: 3, name: 'C', email: null, company: null, title: null, linkedin_url: null, website: null, description: null, industry: null, location: null, source: null, added_at: '' },
        ],
        outreach: [
          { id: 1, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'sent', subject: 's', body: 'b', sent_at: '2026-01-01' },
          { id: 2, contact_id: 2, event_id: null, user_id: null, channel: 'email', status: 'draft', subject: 's', body: 'b', sent_at: null },
        ],
      },
    });
    const { GET } = await import('@/app/api/queue/pending-ids/route');
    const res = await GET();
    const body = await res.json();
    expect(body.contact_ids).toEqual([3]);
  });
});

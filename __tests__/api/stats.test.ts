import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from '@tests/helpers/route';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = { id: userId, email: 'a@x.com', name: 'A', role: 'P', created_at: '' };

describe('GET /api/stats', () => {
  beforeEach(() => vi.resetModules());

  it('returns 401 when unauthenticated', async () => {
    await mockSupabase({ authUser: null });
    const { GET } = await import('@/app/api/stats/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns counts and metadata when authenticated', async () => {
    await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        contacts: [
          { id: 1, name: 'A', email: null, company: null, title: null, linkedin_url: null, website: null, description: null, industry: null, location: null, source: null, added_at: '2026-01-01' },
          { id: 2, name: 'B', email: null, company: null, title: null, linkedin_url: null, website: null, description: null, industry: null, location: null, source: null, added_at: '2026-01-02' },
        ],
        outreach: [
          { id: 1, contact_id: 1, event_id: null, user_id: null, channel: 'email', status: 'sent', subject: 's', body: 'b', sent_at: new Date().toISOString() },
          { id: 2, contact_id: 2, event_id: null, user_id: null, channel: 'email', status: 'draft', subject: 's', body: 'b', sent_at: null },
        ],
      },
    });
    const { GET } = await import('@/app/api/stats/route');
    const res = await GET();
    const body = await res.json();
    expect(body.total_contacts).toBe(2);
    expect(body.emails_sent).toBe(1);
    expect(body.pending_drafts).toBe(1);
    expect(body.sent_today).toBe(1);
    expect(body.email_configured).toBe(true);
    expect(body.ai_backend).toBe('gemini');
  });
});

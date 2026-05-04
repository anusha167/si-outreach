import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase, jsonRequest } from '@tests/helpers/route';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = { id: userId, email: 'a@x.com', name: 'A', role: 'P', created_at: '' };

describe('events API', () => {
  beforeEach(() => vi.resetModules());

  it('GET 401 when unauthenticated', async () => {
    await mockSupabase({ authUser: null });
    const { GET } = await import('@/app/api/events/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('GET returns events ordered by created_at desc', async () => {
    await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        events: [
          { id: 1, name: 'A', date: null, description: null, what_we_need: null, created_by: null, created_at: '2026-01-01' },
          { id: 2, name: 'B', date: null, description: null, what_we_need: null, created_by: null, created_at: '2026-02-01' },
        ],
      },
    });
    const { GET } = await import('@/app/api/events/route');
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('B'); // newest first
  });

  it('POST requires name (400)', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/events/route');
    const res = await POST(jsonRequest('http://t', {}));
    expect(res.status).toBe(400);
  });

  it('POST creates an event with all fields', async () => {
    const { fake } = await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/events/route');
    const res = await POST(jsonRequest('http://t', {
      name: 'Demo Day',
      date: '2026-05-01',
      description: 'desc',
      what_we_need: 'sponsors',
    }));
    expect(res.status).toBe(201);
    expect(fake._db.events).toHaveLength(1);
    expect(fake._db.events[0]?.name).toBe('Demo Day');
  });

  it('DELETE removes an event', async () => {
    const event = { id: 5, name: 'Demo', date: null, description: null, what_we_need: null, created_by: null, created_at: '' };
    const { fake } = await mockSupabase({
      authUser: { id: userId },
      db: { profiles: [profile], events: [event] },
    });
    const { DELETE } = await import('@/app/api/events/[id]/route');
    const res = await DELETE(new Request('http://t'), { params: Promise.resolve({ id: '5' }) });
    expect(res.status).toBe(200);
    expect(fake._db.events).toHaveLength(0);
  });
});

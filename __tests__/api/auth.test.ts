import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from '@tests/helpers/route';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = {
  id: userId,
  email: 'admin@x.com',
  name: 'Admin',
  role: 'President',
  created_at: new Date().toISOString(),
};

describe('GET /api/me', () => {
  beforeEach(() => vi.resetModules());

  it('returns logged_in: false when not signed in', async () => {
    await mockSupabase({ authUser: null });
    const { GET } = await import('@/app/api/me/route');
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ logged_in: false });
  });

  it('returns profile when signed in', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { GET } = await import('@/app/api/me/route');
    const res = await GET();
    const body = await res.json();
    expect(body).toMatchObject({
      logged_in: true,
      id: userId,
      email: 'admin@x.com',
      name: 'Admin',
      role: 'President',
    });
  });
});

describe('POST /api/logout', () => {
  beforeEach(() => vi.resetModules());

  it('returns ok', async () => {
    await mockSupabase({ authUser: { id: userId } });
    const { POST } = await import('@/app/api/logout/route');
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});

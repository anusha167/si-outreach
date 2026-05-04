import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase, jsonRequest } from '@tests/helpers/route';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = { id: userId, email: 'a@x.com', name: 'A', role: 'P', created_at: '' };

describe('users API', () => {
  beforeEach(() => vi.resetModules());

  it('GET returns profiles list', async () => {
    await mockSupabase({
      authUser: { id: userId },
      db: { profiles: [profile, { ...profile, id: '00000000-0000-0000-0000-000000000002', email: 'b@x.com', name: 'B' }] },
    });
    const { GET } = await import('@/app/api/users/route');
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('POST 400 when missing email or password', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/users/route');
    const res = await POST(jsonRequest('http://t', { name: 'X' }));
    expect(res.status).toBe(400);
  });

  it('POST 409 on duplicate email', async () => {
    const dup = { ...profile, id: '00000000-0000-0000-0000-000000000002', email: 'taken@x.com', name: 'T' };
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile, dup] } });
    const { POST } = await import('@/app/api/users/route');
    const res = await POST(jsonRequest('http://t', { email: 'taken@x.com', password: 'p' }));
    expect(res.status).toBe(409);
  });

  it('POST creates user and profile', async () => {
    const { fake } = await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/users/route');
    const res = await POST(
      jsonRequest('http://t', { name: 'New', email: 'new@x.com', role: 'Outreach', password: 'pw1234' }),
    );
    expect(res.status).toBe(201);
    expect(fake._db.profiles.find((p: { email: string }) => p.email === 'new@x.com')).toBeDefined();
  });
});

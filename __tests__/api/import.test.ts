import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from '@tests/helpers/route';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = { id: userId, email: 'a@x.com', name: 'A', role: 'P', created_at: '' };

function csvRequest(csv: string): Request {
  const fd = new FormData();
  fd.append('file', new Blob([csv], { type: 'text/csv' }), 'test.csv');
  return new Request('http://t/api/import/csv', { method: 'POST', body: fd });
}

describe('POST /api/import/csv', () => {
  beforeEach(() => vi.resetModules());

  it('returns 400 when no file provided', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { POST } = await import('@/app/api/import/csv/route');
    const res = await POST(new Request('http://t', { method: 'POST', body: new FormData() }));
    expect(res.status).toBe(400);
  });

  it('imports new contacts and skips duplicates', async () => {
    const { fake } = await mockSupabase({
      authUser: { id: userId },
      db: {
        profiles: [profile],
        contacts: [{ id: 1, name: 'Existing', email: 'dup@x.com', company: null, title: null, linkedin_url: null, website: null, description: null, industry: null, location: null, source: null, added_at: '' }],
      },
    });
    const csv = 'name,email,company\nJane,j@x.com,Acme\nDuplicate,dup@x.com,Beta\nBob,b@x.com,Gamma';
    const { POST } = await import('@/app/api/import/csv/route');
    const res = await POST(csvRequest(csv));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.added).toBe(2);
    expect(body.skipped_duplicates).toBe(1);
    expect(body.total_in_file).toBe(3);
    expect(fake._db.contacts).toHaveLength(3);
  });
});

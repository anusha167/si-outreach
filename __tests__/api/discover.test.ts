import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse, server } from '@tests/helpers/msw';
import { mockSupabase } from '@tests/helpers/route';

const userId = '00000000-0000-0000-0000-000000000001';
const profile = { id: userId, email: 'a@x.com', name: 'A', role: 'P', created_at: '' };

describe('GET /api/discover/yc', () => {
  beforeEach(() => vi.resetModules());

  it('returns mocked YC data', async () => {
    server.use(
      http.get('https://api.ycombinator.com/v0.1/companies', () =>
        HttpResponse.json({
          companies: [
            { name: 'Foo', founders: [{ first_name: 'A', last_name: 'B' }], one_liner: 'Y', tags: ['T'], location: 'SF', website: 'https://foo' },
          ],
        }),
      ),
    );
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { GET } = await import('@/app/api/discover/yc/route');
    const res = await GET(new Request('http://t/api/discover/yc?limit=5&batch=W24'));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('A B');
  });

  it('returns [] on failure', async () => {
    server.use(http.get('https://api.ycombinator.com/v0.1/companies', () => HttpResponse.json({}, { status: 500 })));
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { GET } = await import('@/app/api/discover/yc/route');
    const res = await GET(new Request('http://t/api/discover/yc'));
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

describe('GET /api/discover/search', () => {
  beforeEach(() => vi.resetModules());

  it('400 when q missing', async () => {
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { GET } = await import('@/app/api/discover/search/route');
    const res = await GET(new Request('http://t/api/discover/search'));
    expect(res.status).toBe(400);
  });

  it('returns parsed LinkedIn profiles via DDG', async () => {
    server.use(
      http.get('https://html.duckduckgo.com/html/', () =>
        HttpResponse.text('<html><body><a href="https://www.linkedin.com/in/test">Test User - CEO</a></body></html>'),
      ),
    );
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { GET } = await import('@/app/api/discover/search/route');
    const res = await GET(new Request('http://t/api/discover/search?q=founders'));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Test User');
  });
});

describe('GET /api/test-gemini', () => {
  beforeEach(() => vi.resetModules());

  it('returns active_backend gemini when API works', async () => {
    server.use(
      http.post(/generativelanguage\.googleapis\.com/, () =>
        HttpResponse.json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
      ),
    );
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { GET } = await import('@/app/api/test-gemini/route');
    const res = await GET();
    const body = await res.json();
    expect(body.gemini).toBe(true);
    expect(body.active_backend).toBe('gemini');
  });

  it('returns template fallback when API errors', async () => {
    server.use(http.post(/generativelanguage\.googleapis\.com/, () => HttpResponse.json({}, { status: 500 })));
    await mockSupabase({ authUser: { id: userId }, db: { profiles: [profile] } });
    const { GET } = await import('@/app/api/test-gemini/route');
    const res = await GET();
    const body = await res.json();
    expect(body.gemini).toBe(false);
    expect(body.active_backend).toBe('template');
  });
});

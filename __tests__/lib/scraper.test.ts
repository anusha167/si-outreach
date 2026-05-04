import { describe, it, expect } from 'vitest';
import { http, HttpResponse, server } from '@tests/helpers/msw';
import { fetchYcCompanies } from '@/lib/scraper/yc';
import { googleLinkedinSearch } from '@/lib/scraper/linkedin-search';

describe('YC scraper', () => {
  it('extracts founder name from YC payload shape', async () => {
    server.use(
      http.get('https://api.ycombinator.com/v0.1/companies', () =>
        HttpResponse.json({
          companies: [
            {
              name: 'Foo',
              founders: [{ first_name: 'Ada', last_name: 'Lovelace' }],
              website: 'https://foo.com',
              one_liner: 'AI for X',
              tags: ['AI', 'B2B'],
              location: 'SF',
            },
          ],
        }),
      ),
    );
    const out = await fetchYcCompanies({ limit: 1 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: 'Ada Lovelace',
      company: 'Foo',
      title: 'Founder',
      website: 'https://foo.com',
      description: 'AI for X',
      industry: 'AI, B2B',
      location: 'SF',
      source: 'yc',
    });
  });

  it('falls back to company name when no founders', async () => {
    server.use(
      http.get('https://api.ycombinator.com/v0.1/companies', () =>
        HttpResponse.json({ companies: [{ name: 'Foo' }] }),
      ),
    );
    const out = await fetchYcCompanies({ limit: 1 });
    expect(out[0]?.name).toBe('Foo');
  });

  it('returns [] on network failure', async () => {
    server.use(
      http.get('https://api.ycombinator.com/v0.1/companies', () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const out = await fetchYcCompanies({});
    expect(out).toEqual([]);
  });
});

describe('LinkedIn search scraper', () => {
  it('parses DDG redirect-wrapped LinkedIn links', async () => {
    const html = `
      <html><body>
        <a href="//duckduckgo.com/l/?kh=-1&uddg=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fjane-doe">Jane Doe - CEO</a>
        <a href="//duckduckgo.com/l/?kh=-1&uddg=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fbob-smith">Bob Smith | Founder</a>
      </body></html>
    `;
    server.use(
      http.get('https://html.duckduckgo.com/html/', () => HttpResponse.text(html)),
    );
    const out = await googleLinkedinSearch('founder san diego', 5);
    expect(out).toHaveLength(2);
    expect(out[0]?.name).toBe('Jane Doe');
    expect(out[0]?.linkedin_url).toContain('linkedin.com/in/jane-doe');
    expect(out[1]?.name).toBe('Bob Smith');
  });

  it('falls back to Google when DDG returns nothing', async () => {
    server.use(
      http.get('https://html.duckduckgo.com/html/', () => HttpResponse.text('<html></html>')),
      http.get('https://www.google.com/search', () =>
        HttpResponse.text(`<html><body><a href="/url?q=https://www.linkedin.com/in/test-user&sa=U">Test User - VP</a></body></html>`),
      ),
    );
    const out = await googleLinkedinSearch('founder', 5);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('Test User');
  });

  it('dedupes the same profile from multiple links', async () => {
    const html = `
      <html><body>
        <a href="https://www.linkedin.com/in/jane">Jane</a>
        <a href="https://www.linkedin.com/in/jane?something">Jane</a>
        <a href="https://www.linkedin.com/in/jane/">Jane Doe</a>
      </body></html>
    `;
    server.use(
      http.get('https://html.duckduckgo.com/html/', () => HttpResponse.text(html)),
    );
    const out = await googleLinkedinSearch('q', 10);
    expect(out).toHaveLength(1);
  });

  it('ignores non-/in/ links', async () => {
    const html = `
      <html><body>
        <a href="https://www.linkedin.com/company/foo">Foo</a>
        <a href="https://example.com">Random</a>
        <a href="https://www.linkedin.com/in/real">Real Person</a>
      </body></html>
    `;
    server.use(
      http.get('https://html.duckduckgo.com/html/', () => HttpResponse.text(html)),
    );
    const out = await googleLinkedinSearch('q', 10);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('Real Person');
  });
});

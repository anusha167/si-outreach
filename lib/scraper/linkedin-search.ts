import * as cheerio from 'cheerio';
import type { ParsedContact } from '@/lib/csv';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function unwrapRedirect(href: string): string {
  for (const prefix of ['/url?q=', '/l/?kh=-1&uddg=']) {
    const idx = href.indexOf(prefix);
    if (idx >= 0) {
      const after = href.slice(idx + prefix.length);
      const end = after.indexOf('&');
      const target = end >= 0 ? after.slice(0, end) : after;
      try {
        return decodeURIComponent(target);
      } catch {
        return target;
      }
    }
  }
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function extract(html: string, max: number): ParsedContact[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: ParsedContact[] = [];

  $('a[href]').each((_, el) => {
    if (out.length >= max) return false;
    let href = $(el).attr('href') ?? '';
    href = unwrapRedirect(href);
    if (!href.includes('linkedin.com/in/')) return;
    if (!href.startsWith('http')) return;

    href = href.split('?')[0]?.replace(/\/+$/, '') ?? '';
    if (!href || seen.has(href)) return;
    seen.add(href);

    const slug = (href.split('/in/')[1] ?? '').replace(/-/g, ' ');
    const titled = slug.replace(/\b\w/g, (c) => c.toUpperCase());
    const rawName = $(el).text().trim();
    const cleanName = rawName.split(' - ')[0]?.split(' | ')[0]?.split('·')[0]?.trim();
    const name = cleanName || titled;

    out.push({
      name,
      linkedin_url: href,
      email: '',
      company: '',
      title: '',
      description: '',
      industry: '',
      location: '',
      website: '',
      source: 'linkedin_search',
    });
    return;
  });

  return out;
}

async function ddg(query: string, max: number): Promise<ParsedContact[]> {
  const q = encodeURIComponent(`site:linkedin.com/in ${query}`);
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    return extract(await res.text(), max);
  } catch {
    return [];
  }
}

async function google(query: string, max: number): Promise<ParsedContact[]> {
  const q = encodeURIComponent(`site:linkedin.com/in ${query}`);
  try {
    const res = await fetch(`https://www.google.com/search?q=${q}&num=${max}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    return extract(await res.text(), max);
  } catch {
    return [];
  }
}

export async function googleLinkedinSearch(query: string, max = 10): Promise<ParsedContact[]> {
  const a = await ddg(query, max);
  if (a.length > 0) return a;
  return google(query, max);
}

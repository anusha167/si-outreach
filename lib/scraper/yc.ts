import type { ParsedContact } from '@/lib/csv';

const YC_API = 'https://api.ycombinator.com/v0.1/companies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

type YcFounder = { first_name?: string; last_name?: string };
type YcCompany = {
  name?: string;
  founders?: YcFounder[];
  website?: string;
  one_liner?: string;
  long_description?: string;
  tags?: string[];
  location?: string;
};
type YcResponse = { companies?: YcCompany[] };

export async function fetchYcCompanies({
  batch = '',
  industry = '',
  limit = 30,
}: { batch?: string; industry?: string; limit?: number }): Promise<ParsedContact[]> {
  const params = new URLSearchParams({ page: '1', per_page: String(Math.min(limit, 100)) });
  if (batch) params.set('batch', batch);
  if (industry) params.set('industry', industry);

  try {
    const res = await fetch(`${YC_API}?${params.toString()}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as YcResponse;
    const companies = data.companies ?? [];
    return companies.slice(0, limit).map((co): ParsedContact => {
      const f = co.founders?.[0];
      const founderName = f && (f.first_name || f.last_name)
        ? `${f.first_name ?? ''} ${f.last_name ?? ''}`.trim()
        : co.name ?? '';
      return {
        name: founderName,
        company: co.name ?? '',
        title: 'Founder',
        website: co.website ?? '',
        description: co.one_liner || co.long_description || '',
        industry: (co.tags ?? []).join(', '),
        location: co.location ?? '',
        linkedin_url: '',
        email: '',
        source: 'yc',
      };
    });
  } catch {
    return [];
  }
}

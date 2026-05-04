import Papa from 'papaparse';
import type { Contact } from '@/types/database';

const FIELD_ALIASES: Record<keyof Pick<Contact, 'name' | 'email' | 'company' | 'title' | 'linkedin_url' | 'website' | 'description' | 'industry' | 'location'>, string[]> = {
  name: ['name', 'full_name', 'fullname', 'founder', 'contact'],
  email: ['email', 'email_address', 'e-mail'],
  company: ['company', 'company_name', 'organization', 'org'],
  title: ['title', 'job_title', 'position', 'role'],
  linkedin_url: ['linkedin', 'linkedin_url', 'linkedin_profile'],
  website: ['website', 'url', 'company_url', 'homepage'],
  description: ['description', 'about', 'bio', 'summary'],
  industry: ['industry', 'sector', 'vertical'],
  location: ['location', 'city', 'region'],
};

function normalizeHeader(header: string): keyof typeof FIELD_ALIASES | null {
  const h = header.trim().toLowerCase().replace(/\s+/g, '_');
  for (const field of Object.keys(FIELD_ALIASES) as (keyof typeof FIELD_ALIASES)[]) {
    if (FIELD_ALIASES[field].includes(h)) return field;
  }
  return null;
}

export type ParsedContact = Partial<Contact> & { source?: string };

export function parseCsv(content: string): ParsedContact[] {
  const cleaned = content.replace(/^﻿/, ''); // strip BOM
  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h,
  });

  const headerMap = new Map<string, keyof typeof FIELD_ALIASES>();
  for (const col of result.meta.fields ?? []) {
    const norm = normalizeHeader(col);
    if (norm) headerMap.set(col, norm);
  }

  const out: ParsedContact[] = [];
  for (const row of result.data) {
    const c: ParsedContact = { source: 'csv' };
    for (const [origCol, field] of headerMap.entries()) {
      const v = (row[origCol] ?? '').trim();
      if (v) (c as Record<string, string>)[field] = v;
    }
    if (c.name || c.email) out.push(c);
  }
  return out;
}

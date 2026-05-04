import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseCsv } from '@/lib/csv';
import { emailExists } from '@/lib/db';

export async function POST(req: Request) {
  if (!(await getCurrentProfile())) return unauthorized();

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const text = await file.text();
  const contacts = parseCsv(text);
  const sb = await getServerSupabase();

  let added = 0;
  let skipped = 0;
  for (const c of contacts) {
    if (c.email && (await emailExists(sb, c.email))) {
      skipped++;
      continue;
    }
    const insert: Record<string, string> = {};
    for (const k of ['name', 'email', 'company', 'title', 'linkedin_url', 'website', 'description', 'industry', 'location', 'source'] as const) {
      const v = c[k];
      if (typeof v === 'string') insert[k] = v;
    }
    if (!insert.name) insert.name = (insert.email ?? '').split('@')[0] ?? 'Unknown';
    const { error } = await sb.from('contacts').insert(insert);
    if (!error) added++;
  }

  return NextResponse.json({ added, skipped_duplicates: skipped, total_in_file: contacts.length });
}

import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAllContacts, emailExists } from '@/lib/db';

export async function GET() {
  if (!(await getCurrentProfile())) return unauthorized();
  const sb = await getServerSupabase();
  const contacts = await getAllContacts(sb);
  return NextResponse.json(contacts);
}

const FIELDS = [
  'name', 'email', 'company', 'title', 'linkedin_url',
  'website', 'description', 'industry', 'location', 'source',
] as const;

export async function POST(req: Request) {
  if (!(await getCurrentProfile())) return unauthorized();
  const data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!data.name && !data.email) {
    return NextResponse.json({ error: 'Need at least a name or email' }, { status: 400 });
  }
  const sb = await getServerSupabase();
  if (typeof data.email === 'string' && data.email && (await emailExists(sb, data.email))) {
    return NextResponse.json({ error: 'Contact with this email already exists' }, { status: 409 });
  }

  const insert: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = data[f];
    if (typeof v === 'string') insert[f] = v;
  }
  if (!insert.name) insert.name = (insert.email ?? '').split('@')[0] ?? 'Unknown';

  const { data: row, error } = await sb.from('contacts').insert(insert).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (row as { id: number }).id }, { status: 201 });
}

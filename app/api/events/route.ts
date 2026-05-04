import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  if (!(await getCurrentProfile())) return unauthorized();
  const sb = await getServerSupabase();
  const { data } = await sb.from('events').select('*').order('created_at', { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return unauthorized();
  const data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof data.name !== 'string' || !data.name) {
    return NextResponse.json({ error: 'Event name required' }, { status: 400 });
  }
  const sb = await getServerSupabase();
  const { data: row, error } = await sb
    .from('events')
    .insert({
      name: data.name,
      date: data.date || null,
      description: (data.description as string) ?? null,
      what_we_need: (data.what_we_need as string) ?? null,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (row as { id: number }).id }, { status: 201 });
}

import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentProfile())) return unauthorized();
  const { id } = await params;
  const sb = await getServerSupabase();
  await sb.from('contacts').delete().eq('id', Number(id));
  return NextResponse.json({ ok: true });
}

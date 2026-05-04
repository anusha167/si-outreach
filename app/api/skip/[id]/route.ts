import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { markSkipped } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentProfile())) return unauthorized();
  const { id } = await params;
  const sb = await getServerSupabase();
  await markSkipped(sb, Number(id));
  return NextResponse.json({ ok: true });
}

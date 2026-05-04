import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  const sb = await getServerSupabase();
  await sb.auth.signOut();
  return NextResponse.json({ ok: true });
}

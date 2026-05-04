import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getQueue } from '@/lib/db';

export async function GET() {
  if (!(await getCurrentProfile())) return unauthorized();
  const sb = await getServerSupabase();
  return NextResponse.json(await getQueue(sb));
}

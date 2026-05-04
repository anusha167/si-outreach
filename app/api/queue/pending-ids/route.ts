import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getPendingContactIds } from '@/lib/db';

export async function GET() {
  if (!(await getCurrentProfile())) return unauthorized();
  const sb = await getServerSupabase();
  const ids = await getPendingContactIds(sb);
  return NextResponse.json({ contact_ids: ids });
}

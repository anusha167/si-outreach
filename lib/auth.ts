import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

/**
 * Returns the signed-in user's profile, or null if not signed in.
 * Used at the top of every route handler.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile | null) ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized', login_required: true }, { status: 401 });
}

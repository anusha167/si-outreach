import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getStats } from '@/lib/db';
import { isEmailConfigured } from '@/lib/brevo';
import { env } from '@/lib/env';

export async function GET() {
  if (!(await getCurrentProfile())) return unauthorized();
  const sb = await getServerSupabase();
  const stats = await getStats(sb);
  return NextResponse.json({
    ...stats,
    email_configured: isEmailConfigured(),
    ai_backend: env.GEMINI_API_KEY ? 'gemini' : 'template',
  });
}

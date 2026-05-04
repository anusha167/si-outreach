import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/lib/supabase/admin';

export async function GET() {
  if (!(await getCurrentProfile())) return unauthorized();
  const sb = await getServerSupabase();
  const { data } = await sb.from('profiles').select('id,name,email,role,created_at').order('created_at');
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  if (!(await getCurrentProfile())) return unauthorized();
  const data = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    role?: string;
    password?: string;
  };
  if (!data.email || !data.password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Check duplicate
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', data.email)
    .maybeSingle();
  if (existingProfile) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { name: data.name ?? '', role: data.role ?? 'Member' },
  });
  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create user' }, { status: 500 });
  }

  // Trigger handles profile insert; ensure name/role match what was passed
  await admin
    .from('profiles')
    .upsert(
      {
        id: created.user.id,
        email: data.email,
        name: data.name ?? data.email.split('@')[0] ?? 'Member',
        role: data.role ?? 'Member',
      },
      { onConflict: 'id' },
    );

  return NextResponse.json({ id: created.user.id }, { status: 201 });
}

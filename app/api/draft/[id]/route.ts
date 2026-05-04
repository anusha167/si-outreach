import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { deleteDraft, updateDraft } from '@/lib/db';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentProfile())) return unauthorized();
  const { id } = await params;
  const data = (await req.json().catch(() => ({}))) as { subject?: string; body?: string };
  const sb = await getServerSupabase();
  await updateDraft(sb, Number(id), data.subject ?? '', data.body ?? '');
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentProfile())) return unauthorized();
  const { id } = await params;
  const sb = await getServerSupabase();
  await deleteDraft(sb, Number(id));
  return NextResponse.json({ ok: true });
}

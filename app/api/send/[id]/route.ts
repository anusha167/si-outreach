import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { getOutreachForSend, markSent } from '@/lib/db';
import { sendEmail } from '@/lib/brevo';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentProfile())) return unauthorized();
  const { id } = await params;
  const outreachId = Number(id);
  const sb = await getServerSupabase();

  const row = await getOutreachForSend(sb, outreachId);
  if (!row) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  if (!row.to_email) {
    return NextResponse.json(
      { error: 'Contact has no email address — add one in Contacts first' },
      { status: 400 },
    );
  }

  try {
    await sendEmail(row.to_email, row.subject, row.body, row.to_name);
    await markSent(sb, outreachId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

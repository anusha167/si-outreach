import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { alreadyContacted, getContact, getEvent, saveDraft } from '@/lib/db';
import { draftEmail, redraftEmail } from '@/lib/gemini';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return unauthorized();

  const { id } = await params;
  const contactId = Number(id);
  const sb = await getServerSupabase();

  const contact = await getContact(sb, contactId);
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  if (await alreadyContacted(sb, contactId)) {
    return NextResponse.json({ error: 'Already sent to this contact' }, { status: 409 });
  }

  const data = (await req.json().catch(() => ({}))) as {
    event_id?: number | null;
    feedback?: string;
    current_body?: string;
  };

  const event = data.event_id ? await getEvent(sb, data.event_id) : null;
  const sender = { name: profile.name, role: profile.role };

  const result =
    data.feedback && data.current_body
      ? await redraftEmail(contact, data.feedback, data.current_body, sender, event)
      : await draftEmail(contact, event, sender);

  const outreachId = await saveDraft(sb, {
    contactId,
    subject: result.subject,
    body: result.body,
    userId: profile.id,
    eventId: data.event_id ?? null,
  });

  return NextResponse.json({ outreach_id: outreachId, ...result });
}

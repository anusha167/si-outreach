import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { alreadyContacted, contactHasDraft, getContact, getEvent, saveDraft } from '@/lib/db';
import { draftEmail } from '@/lib/gemini';

const MAX_PER_CALL = 5;

export const maxDuration = 60;

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return unauthorized();

  const data = (await req.json().catch(() => ({}))) as {
    event_id?: number | null;
    contact_ids?: number[];
  };

  if (!Array.isArray(data.contact_ids) || data.contact_ids.length === 0) {
    return NextResponse.json({ error: 'contact_ids required' }, { status: 400 });
  }
  if (data.contact_ids.length > MAX_PER_CALL) {
    return NextResponse.json({ error: `max ${MAX_PER_CALL} ids per call` }, { status: 400 });
  }

  const sb = await getServerSupabase();
  const event = data.event_id ? await getEvent(sb, data.event_id) : null;
  const sender = { name: profile.name, role: profile.role };

  const results = await Promise.allSettled(
    data.contact_ids.map(async (contactId) => {
      const contact = await getContact(sb, contactId);
      if (!contact) throw new Error(`contact ${contactId} not found`);
      if (await alreadyContacted(sb, contactId)) throw new Error('already_sent');
      if (await contactHasDraft(sb, contactId)) throw new Error('already_drafted');
      const result = await draftEmail(contact, event, sender);
      const outreachId = await saveDraft(sb, {
        contactId,
        subject: result.subject,
        body: result.body,
        userId: profile.id,
        eventId: data.event_id ?? null,
      });
      return { contact_id: contactId, outreach_id: outreachId };
    }),
  );

  const generated: { contact_id: number; outreach_id: number }[] = [];
  const errors: { contact_id: number; error: string }[] = [];
  results.forEach((r, i) => {
    const cid = data.contact_ids![i]!;
    if (r.status === 'fulfilled') generated.push(r.value);
    else errors.push({ contact_id: cid, error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });

  return NextResponse.json({ generated, errors });
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Contact,
  ContactWithStats,
  Event,
  Outreach,
  Profile,
  QueueItem,
  Stats,
} from '@/types/database';

export async function getStats(sb: SupabaseClient): Promise<Omit<Stats, 'email_configured' | 'ai_backend'>> {
  const [{ count: totalContacts }, { count: emailsSent }, { count: pendingDrafts }] = await Promise.all([
    sb.from('contacts').select('*', { count: 'exact', head: true }),
    sb.from('outreach').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    sb.from('outreach').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
  ]);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await sb
    .from('outreach')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', startOfDay.toISOString());

  return {
    total_contacts: totalContacts ?? 0,
    emails_sent: emailsSent ?? 0,
    pending_drafts: pendingDrafts ?? 0,
    sent_today: sentToday ?? 0,
  };
}

export async function getAllContacts(sb: SupabaseClient): Promise<ContactWithStats[]> {
  const { data: contacts } = await sb
    .from('contacts')
    .select('*')
    .order('added_at', { ascending: false });
  if (!contacts) return [];

  const { data: outreach } = await sb
    .from('outreach')
    .select('contact_id, status, sent_at')
    .eq('status', 'sent');

  const stats = new Map<number, { last_sent: string | null; times_contacted: number }>();
  for (const o of (outreach ?? []) as Pick<Outreach, 'contact_id' | 'sent_at'>[]) {
    const cur = stats.get(o.contact_id) ?? { last_sent: null, times_contacted: 0 };
    cur.times_contacted += 1;
    if (o.sent_at && (!cur.last_sent || o.sent_at > cur.last_sent)) cur.last_sent = o.sent_at;
    stats.set(o.contact_id, cur);
  }

  return (contacts as Contact[]).map((c) => ({
    ...c,
    last_sent: stats.get(c.id)?.last_sent ?? null,
    times_contacted: stats.get(c.id)?.times_contacted ?? 0,
  }));
}

export async function emailExists(sb: SupabaseClient, email: string): Promise<boolean> {
  if (!email) return false;
  const { data } = await sb
    .from('contacts')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function alreadyContacted(sb: SupabaseClient, contactId: number): Promise<boolean> {
  const { data } = await sb
    .from('outreach')
    .select('id')
    .eq('contact_id', contactId)
    .eq('channel', 'email')
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function contactHasDraft(sb: SupabaseClient, contactId: number): Promise<boolean> {
  const { data } = await sb
    .from('outreach')
    .select('id')
    .eq('contact_id', contactId)
    .eq('status', 'draft')
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function saveDraft(
  sb: SupabaseClient,
  args: { contactId: number; subject: string; body: string; userId: string | null; eventId: number | null },
): Promise<number> {
  await sb.from('outreach').delete().eq('contact_id', args.contactId).eq('status', 'draft');
  const { data, error } = await sb
    .from('outreach')
    .insert({
      contact_id: args.contactId,
      event_id: args.eventId,
      user_id: args.userId,
      channel: 'email',
      status: 'draft',
      subject: args.subject,
      body: args.body,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: number }).id;
}

export async function updateDraft(sb: SupabaseClient, id: number, subject: string, body: string) {
  await sb.from('outreach').update({ subject, body }).eq('id', id).eq('status', 'draft');
}

export async function deleteDraft(sb: SupabaseClient, id: number) {
  await sb.from('outreach').delete().eq('id', id).eq('status', 'draft');
}

export async function markSent(sb: SupabaseClient, id: number) {
  await sb.from('outreach').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
}

export async function markSkipped(sb: SupabaseClient, contactId: number) {
  await sb.from('outreach').delete().eq('contact_id', contactId).eq('status', 'draft');
  await sb.from('outreach').insert({ contact_id: contactId, channel: 'email', status: 'skipped' });
}

export async function getQueue(sb: SupabaseClient): Promise<QueueItem[]> {
  const { data, error } = await sb
    .from('outreach')
    .select('id, subject, body, event_id, user_id, contact:contacts(*), event:events(name)')
    .eq('status', 'draft')
    .order('id', { ascending: false });
  if (error) throw error;

  const sentIds = await sb
    .from('outreach')
    .select('contact_id')
    .eq('status', 'sent');
  const sentSet = new Set<number>(((sentIds.data ?? []) as { contact_id: number }[]).map((r) => r.contact_id));

  type Row = {
    id: number;
    subject: string | null;
    body: string | null;
    event_id: number | null;
    user_id: string | null;
    contact: Contact | null;
    event: { name: string } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.contact && !sentSet.has(r.contact.id))
    .map((r) => ({
      ...(r.contact as Contact),
      outreach_id: r.id,
      subject: r.subject ?? '',
      body: r.body ?? '',
      event_id: r.event_id,
      user_id: r.user_id,
      event_name: r.event?.name ?? null,
    }));
}

export async function getOutreachForSend(
  sb: SupabaseClient,
  outreachId: number,
): Promise<{ id: number; subject: string; body: string; to_email: string | null; to_name: string } | null> {
  const { data } = await sb
    .from('outreach')
    .select('id, subject, body, status, contact:contacts(name, email)')
    .eq('id', outreachId)
    .eq('status', 'draft')
    .maybeSingle();
  if (!data) return null;
  type Row = {
    id: number;
    subject: string | null;
    body: string | null;
    contact: { name: string; email: string | null } | null;
  };
  const r = data as unknown as Row;
  return {
    id: r.id,
    subject: r.subject ?? '',
    body: r.body ?? '',
    to_email: r.contact?.email ?? null,
    to_name: r.contact?.name ?? '',
  };
}

export async function getPendingContactIds(
  sb: SupabaseClient,
): Promise<number[]> {
  const { data: contacts } = await sb.from('contacts').select('id');
  const allIds = ((contacts ?? []) as { id: number }[]).map((c) => c.id);
  const { data: outreach } = await sb.from('outreach').select('contact_id, status');
  const sent = new Set<number>();
  const drafted = new Set<number>();
  for (const o of (outreach ?? []) as { contact_id: number; status: string }[]) {
    if (o.status === 'sent') sent.add(o.contact_id);
    if (o.status === 'draft') drafted.add(o.contact_id);
  }
  return allIds.filter((id) => !sent.has(id) && !drafted.has(id));
}

export async function getProfile(sb: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function getEvent(sb: SupabaseClient, id: number): Promise<Event | null> {
  const { data } = await sb.from('events').select('*').eq('id', id).maybeSingle();
  return (data as Event | null) ?? null;
}

export async function getContact(sb: SupabaseClient, id: number): Promise<Contact | null> {
  const { data } = await sb.from('contacts').select('*').eq('id', id).maybeSingle();
  return (data as Contact | null) ?? null;
}

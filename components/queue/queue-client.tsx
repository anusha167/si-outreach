'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Building2, RefreshCw, Trash2, Send, SkipForward, ExternalLink } from 'lucide-react';
import type { Event, QueueItem } from '@/types/database';

const CHUNK = 5;
const PARALLEL_CHUNKS = 2;
const AUTOSAVE_MS = 800;

export function QueueClient() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  const active = useMemo(() => items.find((i) => i.outreach_id === activeId) ?? null, [items, activeId]);

  const load = useCallback(async () => {
    const [q, ev] = await Promise.all([
      fetch('/api/queue', { cache: 'no-store' }).then((r) => r.json() as Promise<QueueItem[]>),
      fetch('/api/events', { cache: 'no-store' }).then((r) => r.json() as Promise<Event[]>),
    ]);
    setItems(q);
    setEvents(ev);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // When the active item changes, populate editor
  useEffect(() => {
    if (active) {
      setSubject(active.subject);
      setBody(active.body);
      setFeedbackOpen(false);
      setFeedback('');
    } else {
      setSubject('');
      setBody('');
    }
  }, [active]);

  // Auto-save
  const lastSaved = useRef<{ subject: string; body: string } | null>(null);
  useEffect(() => {
    if (!active) return;
    if (lastSaved.current && lastSaved.current.subject === subject && lastSaved.current.body === body) return;
    const t = setTimeout(async () => {
      try {
        await fetch(`/api/draft/${active.outreach_id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject, body }),
        });
        lastSaved.current = { subject, body };
      } catch {
        // ignore
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [subject, body, active]);

  async function generateAll() {
    if (busy) return;
    setBusy(true);
    try {
      const idsRes = await fetch(
        `/api/queue/pending-ids${eventId ? `?event_id=${eventId}` : ''}`,
        { cache: 'no-store' },
      );
      const { contact_ids } = (await idsRes.json()) as { contact_ids: number[] };
      if (contact_ids.length === 0) {
        toast('No new contacts to draft.');
        return;
      }

      const chunks: number[][] = [];
      for (let i = 0; i < contact_ids.length; i += CHUNK) chunks.push(contact_ids.slice(i, i + CHUNK));

      setBulk({ done: 0, total: contact_ids.length });
      let allErrors = 0;

      for (let i = 0; i < chunks.length; i += PARALLEL_CHUNKS) {
        const slice = chunks.slice(i, i + PARALLEL_CHUNKS);
        const results = await Promise.all(
          slice.map((chunk) =>
            fetch('/api/draft/batch', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ event_id: eventId, contact_ids: chunk }),
            }).then((r) => r.json() as Promise<{ generated: unknown[]; errors: unknown[] }>),
          ),
        );
        const doneInc = results.reduce((acc, r) => acc + (r.generated?.length ?? 0) + (r.errors?.length ?? 0), 0);
        allErrors += results.reduce((acc, r) => acc + (r.errors?.length ?? 0), 0);
        setBulk((b) => (b ? { done: Math.min(b.done + doneInc, b.total), total: b.total } : null));
      }

      if (allErrors > 0) {
        toast.warning(`Drafted with ${allErrors} error${allErrors === 1 ? '' : 's'}.`);
      } else {
        toast.success('All drafts generated.');
      }
      await load();
    } finally {
      setTimeout(() => setBulk(null), 1500);
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!active) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/draft/contact/${active.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId ?? active.event_id,
          feedback: feedback || undefined,
          current_body: feedback ? body : undefined,
        }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? 'Failed to regenerate');
        return;
      }
      const data = (await r.json()) as { outreach_id: number; subject: string; body: string };
      setSubject(data.subject);
      setBody(data.body);
      setFeedbackOpen(false);
      setFeedback('');
      lastSaved.current = { subject: data.subject, body: data.body };
      toast.success('Draft regenerated.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (!active) return;
    if (!confirm('Delete this draft?')) return;
    await fetch(`/api/draft/${active.outreach_id}`, { method: 'DELETE' });
    setActiveId(null);
    await load();
  }

  async function skip() {
    if (!active) return;
    await fetch(`/api/skip/${active.id}`, { method: 'POST' });
    setActiveId(null);
    await load();
    toast('Skipped.');
  }

  async function send() {
    if (!active || busy) return;
    setBusy(true);
    try {
      // Force final save first
      await fetch(`/api/draft/${active.outreach_id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const r = await fetch(`/api/send/${active.outreach_id}`, { method: 'POST' });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? 'Failed to send');
        return;
      }
      toast.success('Email sent.');
      setActiveId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="select max-w-xs"
          value={eventId ?? ''}
          onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">No specific event</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={generateAll} disabled={busy}>
          {bulk ? `Generating ${bulk.done} / ${bulk.total}…` : 'Generate All Drafts'}
        </button>
        <span className="text-xs text-muted">Pick an event, generate drafts, review and send.</span>
      </div>

      {bulk && (
        <div className="h-1 rounded-full overflow-hidden bg-surface2">
          <div
            className="h-full bg-cta transition-all duration-300"
            style={{ width: `${Math.round((bulk.done / Math.max(bulk.total, 1)) * 100)}%` }}
          />
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: '320px 1fr' }}>
        <aside className="card !p-0 overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
          <div className="px-4 py-3 border-b text-xs uppercase tracking-wider text-muted font-semibold">
            {items.length} draft{items.length === 1 ? '' : 's'}
          </div>
          <div className="overflow-y-auto flex-1">
            {items.length === 0 && (
              <div className="p-6 text-sm text-muted text-center">
                No drafts in queue.
                <br />
                Import contacts and click "Generate All Drafts".
              </div>
            )}
            {items.map((it) => (
              <button
                key={it.outreach_id}
                onClick={() => setActiveId(it.outreach_id)}
                className={`w-full text-left px-4 py-3 border-b border-l-4 transition-colors ${
                  activeId === it.outreach_id
                    ? 'border-l-accent bg-surface2'
                    : 'border-l-transparent hover:bg-surface2'
                }`}
              >
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold truncate">{it.name}</span>
                  <span className="text-xs text-muted truncate">
                    {it.company || it.title || it.email}
                  </span>
                  {it.event_name && (
                    <span className="text-[11px] text-accent mt-1 truncate">{it.event_name}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="card flex flex-col gap-3 max-h-[calc(100vh-220px)] overflow-y-auto">
          {!active ? (
            <div className="grid place-items-center h-full text-sm text-muted py-12">
              ← Select a contact to review their email
            </div>
          ) : (
            <>
              <CompanyCard item={active} />

              <div className="flex flex-col gap-1.5">
                <label className="label">To</label>
                {active.email ? (
                  <div className="input flex items-center justify-between" style={{ background: 'var(--surface)' }}>
                    <span className="font-mono text-sm">{active.email}</span>
                    <span className="text-xs text-muted">{active.name}</span>
                  </div>
                ) : (
                  <div
                    className="input flex items-center justify-between"
                    style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'var(--danger)' }}
                  >
                    <span className="text-sm text-danger">No email on file — add one in Contacts before sending.</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="label">Subject</label>
                <input
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line…"
                />
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <label className="label">Body</label>
                <textarea
                  className="textarea min-h-[280px]"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="btn btn-ghost" onClick={() => setFeedbackOpen((v) => !v)}>
                    <RefreshCw className="size-4" /> Regenerate
                  </button>
                  <button className="btn btn-ghost btn-danger" onClick={deleteDraft}>
                    <Trash2 className="size-4" /> Delete
                  </button>
                  <button className="btn btn-ghost btn-danger" onClick={skip}>
                    <SkipForward className="size-4" /> Skip
                  </button>
                </div>
                <button className="btn btn-primary" onClick={send} disabled={busy}>
                  <Send className="size-4" /> Send Email
                </button>
              </div>

              {feedbackOpen && (
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    placeholder="e.g. make it shorter, focus on sponsorship…"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') regenerate();
                    }}
                  />
                  <button className="btn btn-ghost" onClick={regenerate} disabled={busy}>
                    Apply
                  </button>
                  <button className="btn btn-ghost" onClick={() => setFeedbackOpen(false)}>
                    ✕
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function CompanyCard({ item }: { item: QueueItem }) {
  const lines: string[] = [];
  if (item.title) lines.push(item.title);
  if (item.company) lines.push(item.company);
  return (
    <div
      className="flex items-start justify-between gap-3 p-3 rounded-[10px] border"
      style={{ background: 'var(--surface2)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-[10px] grid place-items-center text-white font-semibold"
          style={{ background: 'var(--accent)' }}
        >
          <Building2 className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-sm">{item.name}</div>
          {lines.length > 0 && <div className="text-xs text-muted">{lines.join(' · ')}</div>}
          {item.description && <div className="text-xs text-muted mt-1 line-clamp-2 max-w-xl">{item.description}</div>}
        </div>
      </div>
      <div className="flex flex-col gap-1 text-xs">
        {item.linkedin_url && (
          <a href={item.linkedin_url} target="_blank" rel="noreferrer" className="text-cta inline-flex items-center gap-1">
            LinkedIn <ExternalLink className="size-3" />
          </a>
        )}
        {item.website && (
          <a href={item.website} target="_blank" rel="noreferrer" className="text-cta inline-flex items-center gap-1">
            Website <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, CalendarDays } from 'lucide-react';
import type { Event } from '@/types/database';

export function EventsClient() {
  const [events, setEvents] = useState<Event[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [whatWeNeed, setWhatWeNeed] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/events', { cache: 'no-store' });
    setEvents((await r.json()) as Event[]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!name.trim()) {
      toast.error('Event name is required.');
      return;
    }
    setBusy(true);
    const r = await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, date, description, what_we_need: whatWeNeed }),
    });
    setBusy(false);
    if (!r.ok) {
      toast.error('Failed to save.');
      return;
    }
    setName('');
    setDate('');
    setDescription('');
    setWhatWeNeed('');
    setOpen(false);
    toast.success('Event saved.');
    await load();
  }

  async function remove(id: number, label: string) {
    if (!confirm(`Delete event "${label}"?`)) return;
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    toast('Event deleted.');
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Events</h1>
        <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
          <Plus className="size-4" /> {open ? 'Close' : 'New Event'}
        </button>
      </div>

      {open && (
        <div className="card flex flex-col gap-3">
          <h2 className="font-semibold">New event</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name *">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Demo Day 2026" />
            </Field>
            <Field label="Date">
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Description" wide>
              <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="What we need from sponsors/speakers" wide>
              <textarea
                className="textarea"
                rows={3}
                value={whatWeNeed}
                onChange={(e) => setWhatWeNeed(e.target.value)}
                placeholder="e.g. Looking for sponsors who can provide $500–$2000 to cover food and venue."
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save Event'}
            </button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {events.length === 0 && (
          <div className="card text-sm text-muted">No events yet — create one to scope your outreach.</div>
        )}
        {events.map((ev) => (
          <div key={ev.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-accent" />
                <span className="font-semibold">{ev.name}</span>
              </div>
              <button className="btn btn-ghost btn-danger" onClick={() => remove(ev.id, ev.name)}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
            {ev.date && <div className="text-xs text-muted">{ev.date}</div>}
            {ev.description && <div className="text-sm">{ev.description}</div>}
            {ev.what_we_need && (
              <div className="text-xs text-muted border-t pt-2">
                <span className="label block mb-0.5">What we need</span>
                {ev.what_we_need}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? 'md:col-span-2' : ''}`}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

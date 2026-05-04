'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink, Trash2, Pencil } from 'lucide-react';
import type { ContactWithStats } from '@/types/database';

export function ContactsClient() {
  const [rows, setRows] = useState<ContactWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/contacts', { cache: 'no-store' });
    setRows((await r.json()) as ContactWithStats[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: number, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    toast('Contact deleted.');
    await load();
  }

  async function draftOne(id: number) {
    const r = await fetch(`/api/draft/contact/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!r.ok) {
      const err = (await r.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? 'Failed to draft');
      return;
    }
    toast.success('Draft created.');
    router.push('/queue');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">All contacts</h1>
        <Link href="/import" className="btn btn-primary">
          + Add Contact
        </Link>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface2">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Links</th>
              <th className="px-4 py-3">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No contacts yet — head to <Link href="/import" className="text-cta">Import</Link> to add some.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-surface2 transition-colors">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-muted">{r.company || '—'}</td>
                <td className="px-4 py-3 text-muted">{r.title || '—'}</td>
                <td className="px-4 py-3 text-muted">{r.email || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 text-xs">
                    {r.linkedin_url && (
                      <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="text-cta inline-flex items-center gap-1">
                        LI <ExternalLink className="size-3" />
                      </a>
                    )}
                    {r.website && (
                      <a href={r.website} target="_blank" rel="noreferrer" className="text-cta inline-flex items-center gap-1">
                        Web <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.last_sent ? (
                    <span className="text-success">sent {new Date(r.last_sent).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button className="btn btn-ghost mr-1" onClick={() => draftOne(r.id)} title="Draft email">
                    <Pencil className="size-3.5" /> Draft
                  </button>
                  <button className="btn btn-ghost btn-danger" onClick={() => remove(r.id, r.name)} title="Delete">
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

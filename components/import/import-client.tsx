'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Search, Building2, UserPlus, ExternalLink } from 'lucide-react';
import type { ParsedContact } from '@/lib/csv';

export function ImportClient() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CsvCard />
      <YcCard />
      <SearchCard />
      <ManualCard />
    </div>
  );
}

function CsvCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/import/csv', { method: 'POST', body: fd });
    setBusy(false);
    if (!r.ok) {
      toast.error('Upload failed.');
      return;
    }
    const data = (await r.json()) as { added: number; skipped_duplicates: number; total_in_file: number };
    toast.success(`Added ${data.added} of ${data.total_in_file} (${data.skipped_duplicates} duplicates).`);
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-2 font-semibold">
        <Upload className="size-4" /> Upload CSV
      </div>
      <p className="text-xs text-muted">
        Columns: <code>name, email, company, title, linkedin_url, website, description, industry, location</code>
      </p>
      <label
        className="border border-dashed rounded-[10px] p-6 text-center cursor-pointer text-sm text-muted"
        style={{ background: 'var(--surface2)' }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? file.name : 'Drop CSV here or click to browse'}
      </label>
      <button className="btn btn-primary self-start" disabled={!file || busy} onClick={upload}>
        {busy ? 'Importing…' : 'Import'}
      </button>
    </div>
  );
}

function PreviewList({ items, refresh }: { items: ParsedContact[]; refresh: () => void }) {
  async function add(c: ParsedContact) {
    const r = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(c),
    });
    if (r.ok) {
      toast.success(`${c.name} added.`);
      refresh();
    } else {
      const err = (await r.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? 'Failed to add.');
    }
  }
  return (
    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
      {items.map((c, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-2 border rounded-[10px] p-3"
          style={{ background: 'var(--surface2)' }}
        >
          <div className="flex flex-col leading-tight min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{c.name || c.company}</div>
            <div className="text-xs text-muted truncate">
              {[c.title, c.company, c.industry].filter(Boolean).join(' · ')}
            </div>
            {c.linkedin_url && (
              <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-[11px] text-cta inline-flex items-center gap-1">
                LinkedIn <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <button className="btn btn-ghost" onClick={() => add(c)}>
            + Add
          </button>
        </div>
      ))}
    </div>
  );
}

function YcCard() {
  const [batch, setBatch] = useState('');
  const [industry, setIndustry] = useState('');
  const [limit, setLimit] = useState(30);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ParsedContact[]>([]);

  async function fetchYc() {
    setBusy(true);
    const r = await fetch(`/api/discover/yc?batch=${encodeURIComponent(batch)}&industry=${encodeURIComponent(industry)}&limit=${limit}`);
    const data = (await r.json()) as ParsedContact[];
    setResults(data);
    setBusy(false);
    if (data.length === 0) toast.warning('No companies found.');
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-2 font-semibold">
        <Building2 className="size-4" /> YC Companies
      </div>
      <p className="text-xs text-muted">Pull founders from Y Combinator's public database.</p>
      <div className="grid grid-cols-3 gap-2">
        <input className="input" placeholder="Batch (e.g. W24)" value={batch} onChange={(e) => setBatch(e.target.value)} />
        <input className="input" placeholder="Industry (optional)" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        <input
          className="input"
          type="number"
          min={1}
          max={100}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        />
      </div>
      <button className="btn btn-primary self-start" onClick={fetchYc} disabled={busy}>
        {busy ? 'Fetching…' : 'Fetch Companies'}
      </button>
      {results.length > 0 && <PreviewList items={results} refresh={() => {}} />}
    </div>
  );
}

function SearchCard() {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(10);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ParsedContact[]>([]);

  async function search() {
    if (!q.trim()) return;
    setBusy(true);
    const r = await fetch(`/api/discover/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    const data = (await r.json()) as ParsedContact[];
    setResults(Array.isArray(data) ? data : []);
    setBusy(false);
    if (Array.isArray(data) && data.length === 0) toast.warning('No profiles found.');
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-2 font-semibold">
        <Search className="size-4" /> Search LinkedIn via web
      </div>
      <p className="text-xs text-muted">Finds public LinkedIn profiles matching your search.</p>
      <input
        className="input"
        placeholder="e.g. startup founder San Diego SaaS"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <input
        className="input"
        type="number"
        min={1}
        max={20}
        value={limit}
        onChange={(e) => setLimit(Number(e.target.value))}
      />
      <button className="btn btn-primary self-start" onClick={search} disabled={busy}>
        {busy ? 'Searching…' : 'Search'}
      </button>
      {results.length > 0 && <PreviewList items={results} refresh={() => {}} />}
    </div>
  );
}

function ManualCard() {
  const [form, setForm] = useState<ParsedContact>({});
  const [busy, setBusy] = useState(false);

  function set<K extends keyof ParsedContact>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function add() {
    if (!form.name && !form.email) {
      toast.error('Need at least a name or email.');
      return;
    }
    setBusy(true);
    const r = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) {
      const err = (await r.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? 'Failed to add.');
      return;
    }
    toast.success('Contact added.');
    setForm({});
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-2 font-semibold">
        <UserPlus className="size-4" /> Add manually
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Name *" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        <input className="input" placeholder="Email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        <input className="input" placeholder="Company" value={form.company ?? ''} onChange={(e) => set('company', e.target.value)} />
        <input className="input" placeholder="Title" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
        <input className="input" placeholder="LinkedIn URL" value={form.linkedin_url ?? ''} onChange={(e) => set('linkedin_url', e.target.value)} />
        <input className="input" placeholder="Website" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} />
        <input className="input" placeholder="Industry" value={form.industry ?? ''} onChange={(e) => set('industry', e.target.value)} />
        <input className="input" placeholder="Location" value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} />
        <textarea
          className="textarea col-span-2"
          rows={2}
          placeholder="Description"
          value={form.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
      <button className="btn btn-primary self-start" onClick={add} disabled={busy}>
        {busy ? 'Adding…' : 'Add Contact'}
      </button>
    </div>
  );
}

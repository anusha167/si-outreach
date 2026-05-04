'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import type { Profile } from '@/types/database';

export function TeamClient() {
  const [team, setTeam] = useState<Profile[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/users', { cache: 'no-store' });
    setTeam((await r.json()) as Profile[]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!email || !password) {
      toast.error('Email and password are required.');
      return;
    }
    setBusy(true);
    const r = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, role: role || 'Member', password }),
    });
    setBusy(false);
    if (!r.ok) {
      const err = (await r.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? 'Failed.');
      return;
    }
    setName('');
    setEmail('');
    setRole('');
    setPassword('');
    toast.success('Member added.');
    await load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card flex flex-col gap-3 lg:col-span-1">
        <div className="flex items-center gap-2 font-semibold">
          <UserPlus className="size-4" /> Add team member
        </div>
        <p className="text-xs text-muted">
          Each member signs in with their own account. Emails they send will be signed with their name and role.
        </p>
        <input className="input" placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="input"
          type="email"
          placeholder="Email *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          placeholder="Role (e.g. Outreach Lead)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Password *"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn btn-primary self-start" onClick={add} disabled={busy}>
          {busy ? 'Adding…' : 'Add Member'}
        </button>
      </div>

      <div className="card !p-0 overflow-hidden lg:col-span-2">
        <table className="w-full text-sm">
          <thead className="bg-surface2">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {team.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No members yet.</td></tr>
            )}
            {team.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-muted">{m.email}</td>
                <td className="px-4 py-3 text-muted">{m.role}</td>
                <td className="px-4 py-3 text-muted text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

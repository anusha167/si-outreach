'use client';
import { useEffect, useState } from 'react';
import { Zap, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import type { Stats } from '@/types/database';

export function Header({ userName, userRole }: { userName: string; userRole: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch('/api/stats', { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as Stats;
        if (alive) setStats(data);
      } catch {
        // ignore
      }
    }
    load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  async function signOut() {
    await getBrowserSupabase().auth.signOut();
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="border-b" style={{ background: 'var(--surface)' }}>
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Zap className="size-5 text-accent" fill="currentColor" />
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold">SI Outreach</span>
            <span className="text-[11px] text-muted">Startup Incubator at UCSD</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Stat label="sent today" value={stats?.sent_today ?? '—'} />
          <Stat label="total sent" value={stats?.emails_sent ?? '—'} />
          <Stat label="in queue" value={stats?.pending_drafts ?? '—'} />
          <Stat label="contacts" value={stats?.total_contacts ?? '—'} />

          <div className="hidden md:flex flex-col items-end leading-tight">
            <span className="text-sm font-medium">{userName}</span>
            <span className="text-[11px] text-muted">{userRole}</span>
          </div>

          <button onClick={signOut} className="btn btn-ghost" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center min-w-[52px]">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}

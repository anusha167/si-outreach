'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/browser';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const sb = getBrowserSupabase();
    const { error: err } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError('Incorrect email or password.');
      return;
    }
    const next = params.get('next') ?? '/queue';
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Zap className="size-6 text-accent" fill="currentColor" />
          <span className="text-lg font-bold">SI Outreach</span>
        </div>

        <form onSubmit={onSubmit} className="card flex flex-col gap-4">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted -mt-2">Startup Incubator at UCSD</p>

          <div className="flex flex-col gap-1.5">
            <label className="label">Email</label>
            <input
              autoFocus
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="label">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="text-sm text-danger">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-muted text-center mt-4">
          Default: admin@siucsd.com / siucsd2026
        </p>
      </div>
    </div>
  );
}

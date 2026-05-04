import { vi } from 'vitest';
import { makeFakeSupabase, type FakeDb } from './fake-supabase';

/**
 * Set up vi.mock-style fakes for the supabase client modules.
 * Call this BEFORE importing route handlers in a test file via dynamic import.
 *
 * Usage:
 *   const { fake } = await mockSupabase({ authUser, db });
 *   const { GET } = await import('@/app/api/contacts/route');
 *   const res = await GET();
 */
type AuthUser = { id: string; email?: string };

export async function mockSupabase(opts: { authUser?: AuthUser | null; db?: Partial<FakeDb> } = {}) {
  const fake = makeFakeSupabase(opts);
  vi.doMock('@/lib/supabase/server', () => ({
    getServerSupabase: () => Promise.resolve(fake),
  }));
  vi.doMock('@/lib/supabase/admin', () => ({
    getAdminSupabase: () => fake,
  }));
  return { fake };
}

export function jsonRequest(url: string, body: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

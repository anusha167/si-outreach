/**
 * Seed default admin user via Supabase admin API.
 * Run after applying the migration: `pnpm seed`
 */
import { config } from 'dotenv';
import path from 'node:path';
// Load .env.local (Next.js convention) before .env
config({ path: path.resolve(process.cwd(), '.env.local') });
config();
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.DEFAULT_EMAIL ?? 'admin@siucsd.com';
const PASSWORD = process.env.DEFAULT_PASSWORD ?? 'siucsd2026';
const NAME = process.env.DEFAULT_NAME ?? 'Admin';
const ROLE = process.env.DEFAULT_ROLE ?? 'President';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Idempotent: try to find existing user first
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());

  if (existing) {
    console.log(`User ${EMAIL} already exists (id=${existing.id}). Skipping create.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: NAME, role: ROLE },
    });
    if (error) {
      console.error('Failed to create user:', error.message);
      process.exit(1);
    }
    console.log(`Created auth user ${EMAIL} (id=${data.user?.id})`);
  }

  // Make sure profile row exists / is up to date
  const userId = existing?.id ?? (await admin.auth.admin.listUsers()).data.users.find(u => u.email?.toLowerCase() === EMAIL.toLowerCase())?.id;
  if (!userId) {
    console.error('Could not resolve user id after create.');
    process.exit(1);
  }

  const { error: upsertErr } = await admin
    .from('profiles')
    .upsert({ id: userId, email: EMAIL, name: NAME, role: ROLE }, { onConflict: 'id' });

  if (upsertErr) {
    console.error('Failed to upsert profile:', upsertErr.message);
    process.exit(1);
  }

  console.log(`✓ Seed complete. Sign in at /login with ${EMAIL} / ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

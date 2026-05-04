-- SI Outreach — initial schema
-- Run this in the Supabase SQL editor for project kargxhcpiyqaqkzxtics.

-- Profiles mirror auth.users with app metadata
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null unique,
  role        text not null default 'Member',
  created_at  timestamptz not null default now()
);

-- Sync auth.users → profiles on insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'Member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Events
create table if not exists public.events (
  id            bigserial primary key,
  name          text not null,
  date          date,
  description   text,
  what_we_need  text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Contacts
create table if not exists public.contacts (
  id            bigserial primary key,
  name          text not null,
  email         text,
  company       text,
  title         text,
  linkedin_url  text,
  website       text,
  description   text,
  industry      text,
  location      text,
  source        text,
  added_at      timestamptz not null default now()
);
create unique index if not exists contacts_email_lower_idx
  on public.contacts (lower(email)) where email is not null and email <> '';

-- Outreach
create table if not exists public.outreach (
  id          bigserial primary key,
  contact_id  bigint not null references public.contacts(id) on delete cascade,
  event_id    bigint references public.events(id) on delete set null,
  user_id     uuid references public.profiles(id) on delete set null,
  channel     text not null default 'email',
  status      text not null default 'draft',  -- 'draft' | 'sent' | 'skipped'
  subject     text,
  body        text,
  sent_at     timestamptz
);
create index if not exists outreach_contact_channel_idx on public.outreach (contact_id, channel);
create index if not exists outreach_status_idx on public.outreach (status);

-- RLS — single-team app: any authenticated user has full access
alter table public.profiles enable row level security;
alter table public.events   enable row level security;
alter table public.contacts enable row level security;
alter table public.outreach enable row level security;

-- profiles
drop policy if exists "profiles_authenticated_select" on public.profiles;
create policy "profiles_authenticated_select" on public.profiles
  for select using (auth.role() = 'authenticated');
drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

-- events
drop policy if exists "events_authenticated_all" on public.events;
create policy "events_authenticated_all" on public.events
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- contacts
drop policy if exists "contacts_authenticated_all" on public.contacts;
create policy "contacts_authenticated_all" on public.contacts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- outreach
drop policy if exists "outreach_authenticated_all" on public.outreach;
create policy "outreach_authenticated_all" on public.outreach
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

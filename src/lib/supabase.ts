import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

export function isDbConfigured(): boolean {
  return !!(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

/** SQL to run once in Supabase SQL editor */
export const SCHEMA_SQL = `
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  goal text not null,
  live_model boolean default false,
  live_provider text,
  summary jsonb,
  created_at timestamptz default now()
);

create table if not exists steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade,
  step_id text not null,
  description text not null,
  gate_decision text,
  risk_level text,
  risk_score real,
  confidence real,
  executed boolean default false,
  human_decision text,
  decided_at timestamptz,
  note text,
  agents jsonb,
  created_at timestamptz default now()
);

create table if not exists usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  day date not null,
  runs int default 0,
  unique (user_key, day)
);

create index if not exists steps_pending_idx
  on steps (human_decision, gate_decision)
  where gate_decision = 'needs_human' and human_decision is null;
`;

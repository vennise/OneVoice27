-- Run this in Supabase SQL Editor, then put the project URL and anon key in supabase-config.js.
create table if not exists public.site_stats (id boolean primary key default true, visitors bigint not null default 0, shares bigint not null default 0);
insert into public.site_stats (id) values (true) on conflict (id) do nothing;
alter table public.site_stats enable row level security;

create or replace function public.increment_visitors() returns bigint language sql security definer set search_path = public as $$
  update site_stats set visitors = visitors + 1 where id = true returning visitors;
$$;
create or replace function public.increment_shares() returns bigint language sql security definer set search_path = public as $$
  update site_stats set shares = shares + 1 where id = true returning shares;
$$;
create or replace function public.get_site_stats() returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('visitors', visitors, 'shares', shares) from site_stats where id = true;
$$;
revoke all on table public.site_stats from anon, authenticated;
grant execute on function public.increment_visitors() to anon, authenticated;
grant execute on function public.increment_shares() to anon, authenticated;
grant execute on function public.get_site_stats() to anon, authenticated;

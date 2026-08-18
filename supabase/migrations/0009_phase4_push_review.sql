-- Phase 4 — Web Push 구독 + 주간 리뷰 (SPEC.md 5.6, 5.5)

create table push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now()
);

create table weekly_reviews (
  id            uuid primary key default gen_random_uuid(),
  week_start    date not null unique,
  status        text not null default 'pending',
  content       jsonb,
  created_at    timestamptz not null default now(),
  check (status in ('pending', 'ready', 'failed'))
);

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

do $$
declare t text;
begin
  foreach t in array array['push_subscriptions', 'weekly_reviews']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy allowed_user_all on %I for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user())',
      t
    );
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

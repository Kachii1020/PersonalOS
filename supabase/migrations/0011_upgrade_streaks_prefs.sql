-- Tier 1–2 업그레이드 (docs/UPGRADE-PLAN.html)

-- 1. 알림 세분화 (2-C). 카테고리별 on/off. 기존 구독은 기본값을 받는다.
alter table push_subscriptions
  add column if not exists prefs jsonb
    not null default '{"briefing":true,"quiz":true,"deadline":true,"sync_fail":false}'::jsonb;

-- 2. 스트릭(1-A)은 뷰를 만들지 않는다. 단일 사용자라 집계가 빠르고,
--    lib/repos/streaks.ts가 기존 테이블을 직접 쿼리한다.

-- 3. 전역 검색(1-C). 데이터가 작아 ilike로 충분하지만 trigram 인덱스를 미리 건다.
create extension if not exists pg_trgm;
create index if not exists idx_events_summary_trgm on events using gin (summary gin_trgm_ops);
create index if not exists idx_tasks_title_trgm on tasks using gin (title gin_trgm_ops);

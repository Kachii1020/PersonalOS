-- 반복 일정의 EXDATE. 조회 시점 전개가 제외 날짜를 존중하려면 미러에 남아야 한다.
-- 0008이 아니라 0010인 이유: 호스티드가 0009를 먼저 적용해서 0008을 사이에 끼울 수 없다.
alter table events
  add column if not exists exdates text[] not null default '{}';

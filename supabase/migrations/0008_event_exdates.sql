-- 반복 일정의 EXDATE. 조회 시점 전개가 제외 날짜를 존중하려면 미러에 남아야 한다.
alter table events
  add column exdates text[] not null default '{}';

-- SEC EDGAR XBRL — 미국 종목 분기 재무제표 저장.
-- tickers 테이블의 미국 개별 종목에 대해 companyfacts에서 추출한 실적 데이터.

create table sec_filings (
  id            bigserial primary key,
  ticker_id     uuid not null references tickers(id) on delete cascade,
  cik           text not null,
  fiscal_end    date not null,
  form_type     text not null,            -- '10-K' | '10-Q'
  revenue       numeric(18,2),
  net_income    numeric(18,2),
  eps           numeric(12,4),
  total_assets  numeric(18,2),
  equity        numeric(18,2),
  filed_at      date,
  unique (ticker_id, fiscal_end, form_type)
);

-- RLS (0005/0006 패턴)
alter table sec_filings enable row level security;
create policy allowed_user_all on sec_filings
  for all to authenticated
  using (public.is_allowed_user())
  with check (public.is_allowed_user());
grant select, insert, update, delete on sec_filings to authenticated;
grant all on sec_filings to service_role;
grant usage, select on all sequences in schema public to authenticated;

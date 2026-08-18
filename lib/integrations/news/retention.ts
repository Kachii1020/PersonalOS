/** 뉴스 보존 기간. fetch-news 잡 말미에 이보다 오래된 행을 지운다. */
export const NEWS_RETENTION_DAYS = 30;

/** `fetched_at`이 이 시각보다 이른 행이 정리 대상이다. */
export function newsPruneCutoff(now: Date, days: number = NEWS_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

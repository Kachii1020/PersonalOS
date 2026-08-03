import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 크론 엔드포인트 공통 인증. GitHub Actions가 x-cron-secret 헤더로 호출한다.
 * 통과하면 null, 아니면 그대로 반환할 응답을 돌려준다.
 */
export function rejectUnauthorizedCron(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "서버에 CRON_SECRET이 설정되지 않았습니다." }, { status: 500 });
  }
  if (request.headers.get("x-cron-secret") !== expected) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }
  return null;
}

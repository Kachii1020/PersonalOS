import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 정적 자산과 이미지 최적화 경로는 건너뛴다.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|woff2?)$).*)",
  ],
};

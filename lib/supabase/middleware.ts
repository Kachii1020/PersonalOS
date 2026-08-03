import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * 세션 검사를 건너뛰는 경로. 나머지는 전부 /login으로 보낸다.
 *
 * `/api/jobs`는 크론이 x-cron-secret 헤더로 인증한다. 세션이 없다고 리다이렉트하면
 * 잡이 로그인 페이지 HTML을 받게 된다.
 */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/jobs"];

/**
 * 세션 쿠키를 갱신하고, 미인증 요청을 /login으로 돌린다.
 * @supabase/ssr 규칙상 여기서 만든 response를 그대로 반환해야 쿠키가 유지된다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

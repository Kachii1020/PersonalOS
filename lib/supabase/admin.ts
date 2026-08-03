import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * 서비스 롤 클라이언트. RLS를 우회하므로 크론 잡과 서버 라우트에서만 쓴다.
 * `server-only`가 클라이언트 번들에 섞이는 걸 빌드 시점에 막는다.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("환경변수 NEXT_PUBLIC_SUPABASE_URL 없음");
  if (!key) throw new Error("환경변수 SUPABASE_SERVICE_ROLE_KEY 없음");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

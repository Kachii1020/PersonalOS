import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

/** 브라우저용 Supabase 클라이언트. anon 키만 쓴다 — 서비스 롤 키는 절대 여기 오면 안 된다. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

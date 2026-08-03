"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type SignInResult = { ok: boolean; message: string };

/**
 * 매직 링크를 보낸다. 화이트리스트 이메일이 아니면 메일 자체를 보내지 않는다.
 *
 * RLS가 데이터 접근을 한 번 더 막지만, 여기서 먼저 잘라야
 * 아무나 로그인 링크를 받아가는 걸 막을 수 있다.
 */
export async function sendMagicLink(_prev: SignInResult | null, formData: FormData): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

  if (!allowed) {
    return { ok: false, message: "서버에 ALLOWED_EMAIL이 설정되지 않았습니다. .env.local을 확인하세요." };
  }
  if (email !== allowed) {
    return { ok: false, message: "허용되지 않은 이메일입니다. 이 앱은 단일 사용자용입니다." };
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return { ok: false, message: `로그인 링크 발송 실패: ${error.message}` };
  }
  return { ok: true, message: "로그인 링크를 보냈습니다. 메일함을 확인하세요." };
}

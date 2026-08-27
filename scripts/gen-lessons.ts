/**
 * 도메인 레슨 생성 스크립트 (로컬 실행용).
 * Next.js 요청 컨텍스트 밖에서 실행하므로 admin 클라이언트를 직접 사용한다.
 *
 * 사용:
 * cp node_modules/server-only/index.js node_modules/server-only/index.js.bak
 * echo '// stub' > node_modules/server-only/index.js
 * export $(grep -v '^#' .env.local | grep -v 'APP_CALENDAR' | xargs) && npx tsx scripts/gen-lessons.ts
 * cp node_modules/server-only/index.js.bak node_modules/server-only/index.js
 */

import { createClient } from "@supabase/supabase-js";
import { QUIZ_DOMAINS } from "@/lib/ai/prompts/quiz";
import { callStructured } from "@/lib/ai/client";
import {
  DOMAIN_LESSON_SCHEMA,
  DOMAIN_LESSON_SYSTEM,
  buildDomainLessonPrompt,
  type DomainLessonPayload,
} from "@/lib/ai/prompts/domain-lesson";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  for (const domain of QUIZ_DOMAINS) {
    // Check existing
    const { data: existing } = await supabase
      .from("quiz_domain_lessons")
      .select("domain, title")
      .eq("domain", domain)
      .maybeSingle();

    if (existing) {
      console.log(`✓ ${domain}: already exists — "${existing.title}"`);
      continue;
    }

    console.log(`→ generating lesson for ${domain}...`);
    const result = await callStructured<DomainLessonPayload>({
      purpose: "domain_lesson",
      system: DOMAIN_LESSON_SYSTEM,
      userMessage: buildDomainLessonPrompt(domain),
      schema: DOMAIN_LESSON_SCHEMA,
    });

    const lesson = result.data.lesson;
    const { error } = await supabase.from("quiz_domain_lessons").upsert({
      domain,
      title: lesson.title,
      content: lesson.content,
      key_terms: lesson.key_terms,
      generated_at: new Date().toISOString(),
    });

    if (error) throw error;
    console.log(`✓ ${domain}: generated — "${lesson.title}"`);
  }
  console.log("Done.");
}

main().catch(console.error);

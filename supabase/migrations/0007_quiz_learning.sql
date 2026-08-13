-- 퀴즈 학습 시스템 보강: concept_hint + domain micro-lessons

-- Element A: 문제별 개념 힌트 (정답을 드러내지 않되, 풀기 위해 알아야 할 개념 2~3문장)
ALTER TABLE quiz_questions ADD COLUMN concept_hint text;

-- Element C: 도메인별 마이크로 레슨 (한 번 생성, 영구 캐시)
CREATE TABLE quiz_domain_lessons (
  domain        text PRIMARY KEY,   -- QUIZ_DOMAINS 값과 일치 (ib, accounting, macro, ai_ml, system_design)
  title         text NOT NULL,
  content       text NOT NULL,      -- 마크다운 없는 구조화 텍스트
  key_terms     text[] NOT NULL,    -- 핵심 용어 목록
  generated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_domain_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY allowed_user_all ON quiz_domain_lessons
  FOR ALL TO authenticated
  USING (public.is_allowed_user())
  WITH CHECK (public.is_allowed_user());
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_domain_lessons TO authenticated;
GRANT ALL ON quiz_domain_lessons TO service_role;

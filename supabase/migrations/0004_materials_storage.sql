-- 강의자료 파일 보관소 (SPEC.md 4절 course_materials.storage_path)
--
-- 크기·형식 제한을 버킷에 건다. 앱에서만 검사하면 앱을 우회한 업로드를 막지 못하고,
-- 무엇보다 "왜 거부됐는지"가 한 곳에 모인다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,                       -- 공개 URL 없음. 조회는 서명 URL로만.
  52428800,                    -- 50MB. 강의 슬라이드 한 개가 이보다 크면 쪼개서 올린다.
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;

-- 0001의 is_allowed_user()를 그대로 쓴다. 화이트리스트 판정을 두 벌로 두지 않는다.
create policy materials_allowed_user on storage.objects
  for all to authenticated
  using (bucket_id = 'materials' and public.is_allowed_user())
  with check (bucket_id = 'materials' and public.is_allowed_user());

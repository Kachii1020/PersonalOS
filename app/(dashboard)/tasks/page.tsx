import { EmptyState } from "@/components/ui/empty-state";

// ui-shell이 만든 자리표시자. ui-widgets 차례에 실제 화면으로 교체된다.
export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-text">마감·할 일</h1>
      <EmptyState message="태스크 목록은 ui-widgets 차례에 붙습니다." />
    </>
  );
}

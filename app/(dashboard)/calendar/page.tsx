import { EmptyState } from "@/components/ui/empty-state";

// ui-shell이 만든 자리표시자. ui-widgets 차례에 실제 화면으로 교체된다.
export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-text">캘린더</h1>
      <EmptyState message="월·주 캘린더와 이벤트 생성은 integration-caldav와 ui-widgets 차례에 붙습니다." />
    </>
  );
}

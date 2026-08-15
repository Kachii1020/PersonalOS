"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { buttonClass } from "@/components/ui/button";

/**
 * (dashboard) 세그먼트 전체의 공용 에러 바운더리.
 * page.tsx의 렌더 중 처리되지 않은 예외를 여기서 잡는다.
 */
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <ErrorState
        what="페이지를 불러오는 중 오류가 발생했습니다"
        fix="아래 버튼으로 다시 시도하세요. 계속되면 설정에서 잡 로그를 확인하세요."
        action={
          <button onClick={reset} className={buttonClass()}>
            다시 시도
          </button>
        }
      />
    </Card>
  );
}

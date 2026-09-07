"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";

export default function JarvisError({ reset }: { reset: () => void }) {
  return <Card><ErrorState what="대화 화면을 불러오지 못했습니다." fix="다시 열어 주세요. 이미 승인함에 저장한 요청은 승인함에서 확인할 수 있습니다." action={<Button onClick={reset}>다시 열기</Button>} /></Card>;
}

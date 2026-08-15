import Link from "next/link";
import { Compass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <Card className="max-w-md">
        <EmptyState
          icon={Compass}
          className="items-center text-center"
          message="요청하신 페이지를 찾을 수 없습니다. 주소를 확인하거나 대시보드로 돌아가세요."
          action={
            <Link href="/" className={buttonClass()}>
              대시보드로 돌아가기
            </Link>
          }
        />
      </Card>
    </div>
  );
}

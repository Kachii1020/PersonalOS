// app/(dashboard)/learn/page.tsx
// Curriculum tracker + quiz interface for Excel for Finance track.

import { Suspense } from "react";
import { LearnDashboard } from "@/components/widgets/LearnDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Learn — Personal OS" };

export default function LearnPage() {
  return (
    <Suspense fallback={<LearnSkeleton />}>
      <LearnDashboard />
    </Suspense>
  );
}

function LearnSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-2 w-full rounded" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

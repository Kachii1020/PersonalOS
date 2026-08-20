"use client";

import { useEffect, useState } from "react";
import { hhmm } from "@/lib/time";

/**
 * 주간 뷰의 현재 시각 인디케이터 (2-A). 1분마다 갱신.
 * 표시 범위(startHour–endHour) 밖이면 그리지 않는다.
 */
export function NowLine({
  startHour,
  endHour,
  pxPerHour,
}: {
  startHour: number;
  endHour: number;
  pxPerHour: number;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const [h, m] = hhmm(new Date().toISOString()).split(":").map(Number) as [number, number];
      setMinutes(h * 60 + m);
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  if (minutes === null) return null;
  if (minutes < startHour * 60 || minutes > endHour * 60) return null;

  const top = ((minutes - startHour * 60) / 60) * pxPerHour;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={{ top }}>
      <div className="h-px bg-negative" />
      <div className="-mt-[3px] ml-0 size-1.5 rounded-full bg-negative" />
    </div>
  );
}

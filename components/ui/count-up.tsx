"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 헤드라인 숫자에만 쓰는 짧은 카운트업 (UX 개선 F11).
 * 테이블 안의 숫자처럼 많이 반복되는 곳에는 쓰지 않는다 — 화면이 어지러워진다.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 400,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) * (1 - t); // ease-out
      setDisplay(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = to;
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}

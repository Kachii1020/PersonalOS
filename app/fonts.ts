import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";

/**
 * 본문/UI는 Pretendard Variable, 숫자는 JetBrains Mono (SPEC.md 6.3).
 * 헤드라인용 별도 서체는 두지 않는다 — 대시보드에서 장식용 서체는 정보 밀도를 떨어뜨린다.
 */

export const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

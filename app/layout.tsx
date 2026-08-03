import type { Metadata, Viewport } from "next";
import { jetbrainsMono, pretendard } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal OS",
  description: "커리어 학습, 스케줄, 시사·금융 정보를 한 곳에서 관리하는 개인 대시보드",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Personal OS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f16" },
  ],
};

/**
 * 첫 페인트 전에 테마를 확정한다. 이게 없으면 새로고침마다 화면이 번쩍인다.
 * 저장된 값이 없을 때만 시스템 설정을 따른다.
 */
const bootScript = `
(function () {
  try {
    var saved = localStorage.getItem("theme");
    var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className={`${pretendard.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

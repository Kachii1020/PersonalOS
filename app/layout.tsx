import type { Metadata, Viewport } from "next";
import { jetbrainsMono, pretendard } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal OS",
  description: "커리어 학습, 스케줄, 시사·금융 정보를 한 곳에서 관리하는 개인 대시보드",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Personal OS",
    /* 투명 상태바 — 콘텐츠가 화면 끝까지 확장되어 네이티브 앱처럼 보인다. */
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  /* cover: 노치·다이나믹 아일랜드 아래까지 콘텐츠를 확장한다. safe area는 CSS env()로 처리. */
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
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
`;

/**
 * 서비스 워커는 프로덕션에서만 등록한다.
 * 개발 서버의 청크 경로는 해시가 없어서 캐시-우선으로 잡으면 낡은 번들이 계속 살아남는다.
 */
const swScript = `
(function () {
  var expectedVersion = "personal-os-sw-2026-09-09-delivery-v1";
  var registration = null;
  var checkSerial = 0;
  function publish(status, version, callbacks) {
    var state = { status: status, expectedVersion: expectedVersion, version: version || null, workDeliveryCallbacks: callbacks === true };
    window.personalOsServiceWorker = state;
    window.dispatchEvent(new CustomEvent("personalos:service-worker", { detail: state }));
  }
  if (!("serviceWorker" in navigator)) { publish("unsupported"); return; }
  publish("checking");
  function verify() {
    var serial = ++checkSerial;
    var worker = navigator.serviceWorker.controller || (registration && registration.active);
    if (!worker) { publish("installing"); return; }
    var channel = new MessageChannel();
    var timer = setTimeout(function () {
      channel.port1.close();
      if (serial === checkSerial) publish("unconfirmed");
    }, 5000);
    channel.port1.onmessage = function (event) {
      var data = event.data;
      if (!data || data.type !== "PERSONAL_OS_SW_VERSION") return;
      clearTimeout(timer); channel.port1.close();
      if (serial !== checkSerial) return;
      var callbacks = data.workDeliveryCallbacks === true;
      publish(data.version === expectedVersion && callbacks ? "ready" : "outdated", typeof data.version === "string" ? data.version : null, callbacks);
    };
    try { worker.postMessage({ type: "PERSONAL_OS_SW_VERSION_REQUEST" }, [channel.port2]); }
    catch (error) { clearTimeout(timer); channel.port1.close(); if (serial === checkSerial) publish("unconfirmed"); }
  }
  function update() {
    if (!registration) return;
    registration.update().then(verify).catch(function () {
      console.warn("Service worker update unavailable; delivery callback readiness is not assumed.");
      verify();
    });
  }
  navigator.serviceWorker.addEventListener("controllerchange", verify);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") update(); });
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(function (value) {
      registration = value;
      registration.addEventListener("updatefound", function () {
        var installing = registration.installing;
        if (installing) installing.addEventListener("statechange", function () { if (installing.state === "activated") verify(); });
      });
      verify(); update();
    }).catch(function () {
      publish("registration_failed");
      console.warn("Service worker registration failed; delivery callbacks are not ready.");
    });
  });
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        {process.env.NODE_ENV === "production" && (
          <script dangerouslySetInnerHTML={{ __html: swScript }} />
        )}
      </head>
      <body className={`${pretendard.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

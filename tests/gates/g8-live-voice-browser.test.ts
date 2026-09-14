import test from "node:test";
import assert from "node:assert/strict";
import { chromium, type Page, type Route } from "playwright";

const app = process.env.G8_LIVE_APP_URL ?? "http://127.0.0.1:3056";

type Capture = {
  sessionBodies: Record<string, unknown>[];
  turnBodies: Record<string, unknown>[];
  sentEvents: Record<string, unknown>[];
  speechCalls: number;
};

async function browser() {
  const instance = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const page = await instance.newPage();
  page.on("pageerror", cause => console.error("[live-voice-page]", cause.message));
  await page.addInitScript({ content: `(()=>{const root=window;root.__liveChannels=[];root.__liveRemoteReady=false;class Channel{constructor(){this.onopen=null;this.onclose=null;this.onmessage=null;this.readyState="open";root.__liveChannels.push(this);}send(raw){root.__liveSent.push(JSON.parse(raw));}close(){this.readyState="closed";}emit(data){this.onmessage?.({data:JSON.stringify(data)});}}class Peer{constructor(){this.connectionState="new";this.ontrack=null;this.onconnectionstatechange=null;}addTrack(){}createDataChannel(){const channel=new Channel();setTimeout(()=>channel.onopen?.(),0);return channel;}async createOffer(){return{type:"offer",sdp:"fake-live-offer"};}async setLocalDescription(){}async setRemoteDescription(){root.__liveRemoteReady=true;}close(){this.connectionState="closed";}}root.__liveSent=[];root.__PERSONALOS_LIVE_VOICE_ADAPTERS__={getUserMedia:async()=>({getTracks:()=>[{stop(){}}],getAudioTracks:()=>[{stop(){}}]}),createPeer:()=>new Peer()};HTMLMediaElement.prototype.play=async function(){};HTMLMediaElement.prototype.pause=function(){};})();` });
  return { instance, page };
}

async function routes(page: Page, capture: Capture, turnDelay = 0) {
  await page.route("**/api/jarvis/live/**", async (route: Route) => {
    const request = route.request();
    if (request.url().endsWith("/sessions")) {
      capture.sessionBodies.push(request.postDataJSON());
      return route.fulfill({ json: { sessionId: "00000000-0000-4000-8000-000000000001", providerSessionId: "live_test", sdpAnswer: "fake-live-answer", expiresAt: new Date(Date.now() + 300_000).toISOString(), maxTurns: 8, maxDurationSeconds: 300, model: "gpt-live-1" } });
    }
    if (request.url().endsWith("/delegations")) {
      capture.turnBodies.push(request.postDataJSON());
      if (turnDelay) await new Promise(resolve => setTimeout(resolve, turnDelay));
      return route.fulfill({ json: { mode: "answer", message: "저장된 업무를 이어갑니다.", work: null, preview: null, proposals: [], requestId: crypto.randomUUID(), voice: { turnId: "10000000-0000-4000-8000-000000000001", speech: { payload: { sessionId: "00000000-0000-4000-8000-000000000001", turnId: "10000000-0000-4000-8000-000000000001", attempt: 1, text: "저장된 업무를 이어갑니다.", expiresAt: "2030-01-01T00:00:00Z" }, signature: "test" }, confirmation: null } } });
    }
    return route.fulfill({ status: 404, json: { error: "unexpected" } });
  });
  await page.route("**/api/jarvis/voice/**", async route => {
    if (route.request().url().endsWith("/speech")) capture.speechCalls += 1;
    return route.fulfill({ json: { ok: true } });
  });
}

async function emit(page: Page, event: Record<string, unknown>) {
  await page.evaluate(value => {
    const root = window as unknown as { __liveChannels: { emit: (event: unknown) => void }[] };
    root.__liveChannels.at(-1)!.emit(value);
  }, event);
}

test("a Live delegation sends the correlated transcript through Phase 7 and returns verified commentary", { timeout: 15_000 }, async () => {
  const { instance, page } = await browser();
  const capture: Capture = { sessionBodies: [], turnBodies: [], sentEvents: [], speechCalls: 0 };
  await routes(page, capture);
  try {
    await page.goto(`${app}/voice-test-gate`);
    await page.getByRole("button", { name: "자연 음성 시작" }).click();
    await page.waitForFunction(() => (window as unknown as { __liveRemoteReady: boolean }).__liveRemoteReady);
    await emit(page, { type: "session.started", session: { id: "live_test" } });
    await page.getByText("자연 대화 연결됨").waitFor();
    await emit(page, { type: "session.input_transcript.delta", delta: "이력서 ", start_ms: 1000, end_ms: 1200 });
    await emit(page, { type: "session.delegation.created", offset_ms: 1500, delegation: { id: "item_delegate_1", target: "client" } });
    await page.waitForTimeout(100);
    await emit(page, { type: "session.input_transcript.delta", delta: "준비 이어하자", start_ms: 1200, end_ms: 1500 });
    for (let attempt = 0; attempt < 60 && capture.turnBodies.length === 0; attempt += 1) await page.waitForTimeout(50);
    assert.equal(capture.turnBodies.length, 1, await page.locator("body").innerText());
    await page.waitForFunction(() => document.querySelector('[data-testid="live-reply"]')?.textContent === "저장된 업무를 이어갑니다.");
    assert.equal(capture.turnBodies.length, 1);
    assert.equal(capture.turnBodies[0].transcript, "이력서 준비 이어하자");
    const sent = await page.evaluate(() => (window as unknown as { __liveSent: Record<string, unknown>[] }).__liveSent);
    const result = sent.find(event => event.type === "session.commentary.append");
    assert.equal(result?.delegation_id, "item_delegate_1");
    assert.equal(result?.content, "저장된 업무를 이어갑니다.");
    assert.equal(capture.speechCalls, 0);
  } finally {
    await instance.close();
  }
});

test("a late Phase 7 result cannot speak into a stopped Live session", { timeout: 15_000 }, async () => {
  const { instance, page } = await browser();
  const capture: Capture = { sessionBodies: [], turnBodies: [], sentEvents: [], speechCalls: 0 };
  await routes(page, capture, 200);
  try {
    await page.goto(`${app}/voice-test-gate`);
    await page.getByRole("button", { name: "자연 음성 시작" }).click();
    await page.waitForFunction(() => (window as unknown as { __liveRemoteReady: boolean }).__liveRemoteReady);
    await emit(page, { type: "session.started", session: { id: "live_test" } });
    await emit(page, { type: "session.input_transcript.delta", delta: "이어하자", start_ms: 1000, end_ms: 1300 });
    await emit(page, { type: "session.delegation.created", offset_ms: 1300, delegation: { id: "item_delegate_late", target: "client" } });
    await page.getByRole("button", { name: "자연 음성 종료" }).click();
    await emit(page, { type: "session.closed", reason: "close_requested", usage: { seconds: 2 } });
    await page.waitForTimeout(250);
    const sent = await page.evaluate(() => (window as unknown as { __liveSent: Record<string, unknown>[] }).__liveSent);
    assert.equal(sent.filter(event => event.type === "session.commentary.append").length, 0);
    assert.equal(await page.getByTestId("live-reply").textContent(), "");
  } finally {
    await instance.close();
  }
});

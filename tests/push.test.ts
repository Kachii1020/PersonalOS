import test from "node:test";
import assert from "node:assert/strict";
import { deliverPush } from "@/lib/integrations/push/deliver";

test("HTTP 410 구독은 삭제하고 잡은 계속된다", async () => {
  const removed: string[] = [];
  const result = await deliverPush(
    [
      { endpoint: "https://gone.example/1", p256dh: "a", auth: "b" },
      { endpoint: "https://ok.example/2", p256dh: "c", auth: "d" },
    ],
    { title: "t", body: "b", url: "/" },
    async (sub) => {
      if (sub.endpoint.includes("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      return { statusCode: 201 };
    },
    async (endpoint) => {
      removed.push(endpoint);
    },
  );

  assert.deepEqual(removed, ["https://gone.example/1"]);
  assert.equal(result.gone, 1);
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 0);
});

test("일반 발송 실패는 행을 지우지 않는다", async () => {
  const removed: string[] = [];
  const result = await deliverPush(
    [{ endpoint: "https://fail.example/1", p256dh: "a", auth: "b" }],
    { title: "t", body: "b", url: "/" },
    async () => {
      throw Object.assign(new Error("500"), { statusCode: 500 });
    },
    async (endpoint) => {
      removed.push(endpoint);
    },
  );
  assert.deepEqual(removed, []);
  assert.equal(result.failed, 1);
  assert.equal(result.gone, 0);
});

import assert from "node:assert/strict";

/** These gates temporarily replace fixtures; never run them against hosted data. */
export function assertIsolatedGateDatabase(dbUrl: string | undefined, appUrl: string): void {
  assert.equal(process.env.GATE_ISOLATED_DB, "1", "Use a dedicated test stack and set GATE_ISOLATED_DB=1");
  for (const value of [dbUrl, appUrl]) {
    assert.ok(value, "Gate URL is required");
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname), "Fixture gates require loopback URLs");
  }
}

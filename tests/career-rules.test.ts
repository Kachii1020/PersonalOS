import test from "node:test";
import assert from "node:assert/strict";
import { assessOpportunity, rankOpportunities } from "../lib/career/assessment";
import { validateCareerFacts } from "../lib/career/profile";
import type { AssessmentInput, CareerFact, CareerRequirement, RankedOpportunity } from "../lib/career/types";

const now = new Date("2026-09-06T12:00:00Z");
const fact = (value: CareerFact["value"]): CareerFact => ({ value, verifiedAt: "2026-09-01T00:00:00Z", reviewAt: "2026-10-01T00:00:00Z", source: "User confirmed" });
const rule = (patch: Partial<CareerRequirement> = {}): CareerRequirement => ({ id: "requirement-1", field: "academic_year", operator: "gte", expected: 2, hard: true, quote: "Year 2 or above", sourceId: "source-1", reviewed: true, ...patch });
const input = (patch: Partial<AssessmentInput> = {}): AssessmentInput => ({ facts: { academic_year: fact(3) }, requirements: [rule()], source: { id: "source-1", text: "Requirements: Year 2 or above", checkedAt: now.toISOString(), available: true, official: true, reviewed: true }, requirementsComplete: true, lifecycle: "open", deadline: "2026-10-01T00:00:00Z", now, ...patch });
const item = (id: string, patch: Partial<RankedOpportunity> = {}): RankedOpportunity => ({ id, title: id, organization: "Company", eligibility: "confirmed_eligible", lifecycle: "open", deadline: null, verifiedAt: now.toISOString(), fit: 50, value: 50, effort: 50, decision: "none", deferUntil: null, decisionReason: null, ...patch });

test("reviewed official current hard conditions confirm eligibility; a hard fail wins", () => {
  assert.equal(assessOpportunity(input()).status, "act_now");
  const outcome = assessOpportunity(input({ facts: { academic_year: fact(1) }, requirements: [rule(), rule({ id: "missing", field: "degree", operator: "eq", expected: "bachelor" })] }));
  assert.equal(outcome.eligibility, "not_eligible");
  assert.equal(outcome.status, "archive");
});

test("absent, expired, future and malformed facts stay unknown", () => {
  for (const facts of [{}, { academic_year: { ...fact(3), reviewAt: now.toISOString() } }, { academic_year: { ...fact(3), verifiedAt: "2026-09-07T00:00:00Z" } }, { academic_year: fact("3") }, { academic_year: { ...fact(3), source: "" } }]) {
    const outcome = assessOpportunity(input({ facts }));
    assert.equal(outcome.eligibility, "possibly_eligible");
    assert.equal(outcome.results[0].result, "unknown");
  }
});

test("no vacuous confirmation, unreviewed rules, incomplete extraction, or soft unknowns", () => {
  for (const patch of [{ requirements: [] }, { requirementsComplete: false }, { requirements: [rule({ reviewed: false })] }, { requirements: [rule({ hard: false })] }, { requirements: [rule(), rule({ id: "soft", hard: false, field: "degree", operator: "unknown" })] }]) assert.equal(assessOpportunity(input(patch)).eligibility, "possibly_eligible");
  assert.equal(assessOpportunity(input({ facts: {}, requirements: [rule({ operator: "not_required", expected: null })] })).eligibility, "confirmed_eligible");
  assert.equal(assessOpportunity(input({ requirements: [rule({ operator: "not_required", expected: "anything" })] })).eligibility, "possibly_eligible");
});

test("missing/unofficial/unreviewed/unavailable/stale/future sources invalidate confirmation", () => {
  for (const source of [null, { ...input().source!, available: false }, { ...input().source!, official: false }, { ...input().source!, reviewed: false }, { ...input().source!, checkedAt: "2026-08-29T11:59:59Z" }, { ...input().source!, checkedAt: "2026-09-07T00:00:00Z" }]) assert.equal(assessOpportunity(input({ source })).eligibility, "possibly_eligible");
  assert.equal(assessOpportunity(input({ source: { ...input().source!, checkedAt: "2026-08-29T12:00:00Z" } })).eligibility, "confirmed_eligible");
});

test("quote must exist in the matching source, after whitespace normalization", () => {
  for (const patch of [{ quote: "" }, { quote: "A made up condition" }, { sourceId: "another-source" }]) assert.equal(assessOpportunity(input({ requirements: [rule(patch)] })).eligibility, "possibly_eligible");
  assert.equal(assessOpportunity(input({ requirements: [rule({ quote: "Year  2\n or above" })] })).eligibility, "confirmed_eligible");
});

test("PostgreSQL microsecond source timestamps work without admitting future evidence", () => {
  const evaluate = (checkedAt: string) => assessOpportunity(input({ source: { ...input().source!, checkedAt } })).eligibility;
  assert.equal(evaluate("2026-09-06T11:59:59.123456+00:00"), "confirmed_eligible");
  assert.equal(evaluate("2026-09-07T12:00:00.123456+00:00"), "possibly_eligible");
  assert.equal(evaluate("2026-09-06T12:00:00.000001+00:00"), "possibly_eligible");
  assert.equal(evaluate("2026-09-06T11:59:59.1234567+00:00"), "possibly_eligible");
  assert.equal(evaluate("2026-09-06T24:00:00.123456+00:00"), "possibly_eligible");
});

test("closed, unknown, upcoming, expired and ambiguous deadlines never act now", () => {
  for (const lifecycle of ["closed", "upcoming", "unknown"] as const) assert.notEqual(assessOpportunity(input({ lifecycle })).status, "act_now");
  for (const deadline of [now.toISOString(), "2026-09-01T00:00:00Z", "2026-10-01", "not a date"]) assert.notEqual(assessOpportunity(input({ deadline })).status, "act_now");
  assert.equal(assessOpportunity(input({ deadline: now.toISOString() })).lifecycle, "closed");
});

test("strict ordered numeric and date requirements reject coercion and inverted intervals", () => {
  for (const expected of ["2", true, null, {}, [4, 2]]) {
    const requirement = rule({ operator: Array.isArray(expected) ? "between" : "gte", expected });
    assert.equal(assessOpportunity(input({ requirements: [requirement] })).results[0].result, "unknown");
  }
  const dateInput = input({ facts: { graduation_date: fact("2027-03-31") }, requirements: [rule({ field: "graduation_date", operator: "between", expected: ["2027-01-01", "2027-12-31"] })] });
  assert.equal(assessOpportunity(dateInput).results[0].result, "pass");
  dateInput.requirements[0].expected = ["2027-02-30", "2027-12-31"];
  assert.equal(assessOpportunity(dateInput).results[0].result, "unknown");
  assert.equal(assessOpportunity(input({ requirements: [rule({ field: "invented" as CareerRequirement["field"], operator: "not_required", expected: null })] })).results[0].result, "unknown");
  assert.equal(assessOpportunity(input({ source: { ...input().source!, checkedAt: "2026-09-05T24:00:00Z" } })).eligibility, "possibly_eligible");
});

test("language CEFR ordering is explicit and missing languages remain unknown", () => {
  const sample = input({ facts: { languages: fact({ ja: "C1" }) }, requirements: [rule({ field: "languages", operator: "gte", expected: { language: "ja", minimum: "B2" } })] });
  assert.equal(assessOpportunity(sample).results[0].result, "pass");
  for (const [expected, result] of [[{ language: "ja", minimum: "C2" }, "fail"], [{ language: "en", minimum: "B2" }, "unknown"], [{ language: "ja", minimum: "fluent" }, "unknown"], [{ language: "ja", minimum: "B2", ignored: true }, "unknown"]] as const) {
    sample.requirements[0].expected = expected;
    assert.equal(assessOpportunity(sample).results[0].result, result);
  }
});

test("work authorization never infers unrestricted rights from restricted or unknown", () => {
  for (const [value, level, expected] of [["restricted", "unrestricted", "fail"], ["restricted", "any", "pass"], ["none", "any", "fail"], ["unknown", "any", "unknown"], ["unrestricted", "unrestricted", "pass"]]) {
    assert.equal(assessOpportunity(input({ facts: { work_authorization: fact({ JP: value }) }, requirements: [rule({ field: "work_authorization", operator: "eq", expected: { country: "JP", level } })] })).results[0].result, expected);
  }
});

test("university facts require explicit provenance and support equality or allowed lists", () => {
  const facts = validateCareerFacts({ university: fact("Waseda University") });
  const sample = input({ facts, source: { ...input().source!, text: "Applicants must attend Waseda University." }, requirements: [rule({ field: "university", operator: "eq", expected: "Waseda University", quote: "Applicants must attend Waseda University." })] });
  assert.equal(assessOpportunity(sample).results[0].result, "pass");
  assert.equal(assessOpportunity({ ...sample, facts: {} }).results[0].result, "unknown");
  assert.equal(assessOpportunity({ ...sample, facts: { university: fact("Another University") } }).results[0].result, "fail");
  sample.requirements[0] = { ...sample.requirements[0], operator: "one_of", expected: ["Waseda University", "Another University"] };
  assert.equal(assessOpportunity(sample).results[0].result, "pass");
  sample.requirements[0].operator = "gte";
  assert.equal(assessOpportunity(sample).results[0].result, "unknown");
  for (const value of ["", "x".repeat(161), 123, ["Waseda University"]]) assert.throws(() => validateCareerFacts({ university: fact(value) }));
});

test("skill sets require explicit operators and nonempty typed members", () => {
  for (const [operator, expected, result] of [["all_of", ["TypeScript", "SQL"], "pass"], ["all_of", ["Rust"], "fail"], ["one_of", ["SQL", "Rust"], "pass"], ["all_of", [], "unknown"], ["eq", ["SQL"], "unknown"]] as const) {
    assert.equal(assessOpportunity(input({ facts: { skills: fact(["typescript", "SQL"]) }, requirements: [rule({ field: "skills", operator, expected: [...expected] })] })).results[0].result, result);
  }
});

test("profile validation preserves only explicit well-typed values and provenance", () => {
  const profile = { languages: fact({ ja: "C1" }), work_authorization: fact({ JP: "restricted" }), weekly_days: fact(3), skills: fact(["SQL"]) };
  assert.deepEqual(validateCareerFacts(profile), profile);
  const copy = validateCareerFacts(profile);
  (profile.languages.value as Record<string, string>).ja = "A1";
  assert.deepEqual(copy.languages!.value, { ja: "C1" });
  assert.deepEqual(validateCareerFacts({}), {});
  for (const invalid of [null, [], { guessed_age: fact(22) }, { weekly_days: fact(8) }, { academic_year: fact(1.5) }, { graduation_date: fact("2027-02-30") }, { languages: fact({ ja: "fluent" }) }, { skills: fact(new Array(101).fill("SQL")) }, { degree: { ...fact("bachelor"), confidence: 1 } }, { major: { ...fact("CS"), source: "" } }, { major: { ...fact("CS"), reviewAt: "2026-01-01T00:00:00Z" } }, { available_from: fact("2027-12-01"), available_until: fact("2027-01-01") }, JSON.parse('{"__proto__":{}}')]) assert.throws(() => validateCareerFacts(invalid));
});

test("ranking rejects ineligible/nonopen/stale/deferred/rejected entries, caps at three", () => {
  const candidates = [item("a"), item("b"), item("c"), item("d"), item("closed", { lifecycle: "closed" }), item("possible", { eligibility: "possibly_eligible" }), item("reject", { decision: "reject" }), item("defer", { decision: "defer", deferUntil: "2026-09-01T00:00:00Z" }), item("future", { verifiedAt: "2026-09-07T00:00:00Z" }), item("stale", { verifiedAt: "2026-08-01T00:00:00Z" }), item("expired", { deadline: now.toISOString() }), item("bad-date", { deadline: "2026-10-01" })];
  assert.deepEqual(rankOpportunities(candidates, now, 100).map((entry) => entry.id), ["a", "b", "c"]);
  assert.equal(rankOpportunities(candidates, now, -1).length, 0);
  assert.equal(rankOpportunities(candidates, new Date("invalid")).length, 0);
});

test("bounded scores cannot be poisoned; same deliverable and IDs deduplicate", () => {
  const top = rankOpportunities([item("worst", { fit: Infinity, value: NaN, effort: NaN }), item("better", { fit: 1000, value: 1000, effort: -1, deliverableKey: "essay" }), item("duplicate", { deliverableKey: "essay" }), item("second"), item("second")], now);
  assert.equal(top[0].id, "better");
  assert.equal(top.filter((entry) => entry.deliverableKey === "essay").length, 1);
  assert.equal(top.filter((entry) => entry.id === "second").length, 1);
  assert.ok(top.every((entry) => Number.isFinite(entry.score) && entry.score >= -20 && entry.score <= 100));
});

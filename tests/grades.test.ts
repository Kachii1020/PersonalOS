import test from "node:test";
import assert from "node:assert/strict";
import { calculateGpa } from "@/lib/grades";

/** G2 조건: 과목 3개에 학점을 입력하면 GPA가 4.0 스케일로 정확히 계산된다. */
test("GPA — 과목 3개, 수기 계산과 대조", () => {
  const courses = [
    { credits: 4, grade: "A+" }, // 4 * 4.0 = 16
    { credits: 2, grade: "B" }, //  2 * 2.0 =  4
    { credits: 4, grade: "C" }, //  4 * 1.0 =  4
  ];
  // 수기: (16 + 4 + 4) / (4 + 2 + 4) = 24 / 10 = 2.4
  const result = calculateGpa(courses);
  assert.equal(result?.gpa, 2.4);
  assert.equal(result?.credits, 10);
  assert.equal(result?.gradedCourses, 3);
});

test("GPA — F는 0점으로 분모에 들어간다", () => {
  // 수기: (4*4.0 + 4*0.0) / (4 + 4) = 16 / 8 = 2.0
  assert.equal(calculateGpa([{ credits: 4, grade: "A+" }, { credits: 4, grade: "F" }])?.gpa, 2.0);
});

test("GPA — 성적 없는 과목은 분모에서 빠진다", () => {
  // 수기: 4*3.0 / 4 = 3.0. 이수 중인 4학점 과목은 세지 않는다.
  const result = calculateGpa([{ credits: 4, grade: "A" }, { credits: 4, grade: null }]);
  assert.equal(result?.gpa, 3.0);
  assert.equal(result?.credits, 4);
});

test("GPA — 성적이 하나도 없으면 null (0.00과 구분한다)", () => {
  assert.equal(calculateGpa([{ credits: 4, grade: null }]), null);
  assert.equal(calculateGpa([]), null);
});

test("GPA — 소수 학점", () => {
  // 수기: (1.5*4.0 + 2*3.0) / 3.5 = 12 / 3.5 = 3.428571...
  const result = calculateGpa([{ credits: 1.5, grade: "A+" }, { credits: 2, grade: "A" }]);
  assert.ok(Math.abs((result?.gpa ?? 0) - 12 / 3.5) < 1e-12);
});

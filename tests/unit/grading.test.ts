import { describe, expect, it } from "vitest";
import {
  cgpa,
  computeResultFields,
  lookupGrade,
  roundHalfUp2Decimals,
  semesterGpa,
  type GradeScaleBand,
} from "../../src/server/services/grading.service";

const STANDARD_SCALE: GradeScaleBand[] = [
  { grade: "A", minScore: 70, maxScore: 100, gradePoint: 5 },
  { grade: "B", minScore: 60, maxScore: 69, gradePoint: 4 },
  { grade: "C", minScore: 50, maxScore: 59, gradePoint: 3 },
  { grade: "D", minScore: 45, maxScore: 49, gradePoint: 2 },
  { grade: "E", minScore: 40, maxScore: 44, gradePoint: 1 },
  { grade: "F", minScore: 0, maxScore: 39, gradePoint: 0 },
];

describe("lookupGrade (D4)", () => {
  it.each([
    { score: 0, expectedGrade: "F", expectedPoint: 0 },
    { score: 39.5, expectedGrade: "F", expectedPoint: 0 },
    { score: 39.99, expectedGrade: "F", expectedPoint: 0 },
    { score: 40, expectedGrade: "E", expectedPoint: 1 },
    { score: 44.99, expectedGrade: "E", expectedPoint: 1 },
    { score: 45, expectedGrade: "D", expectedPoint: 2 },
    { score: 59.99, expectedGrade: "C", expectedPoint: 3 },
    { score: 60, expectedGrade: "B", expectedPoint: 4 },
    { score: 69.99, expectedGrade: "B", expectedPoint: 4 },
    { score: 70, expectedGrade: "A", expectedPoint: 5 },
    { score: 100, expectedGrade: "A", expectedPoint: 5 },
  ])(
    "maps boundary score $score to grade $expectedGrade ($expectedPoint pts)",
    ({ score, expectedGrade, expectedPoint }) => {
      const result = lookupGrade(score, STANDARD_SCALE);
      expect(result).toEqual({
        grade: expectedGrade,
        gradePoint: expectedPoint,
      });
    }
  );

  it("returns F with 0 points when score is below the lowest band in scale", () => {
    const scaleWithoutF = STANDARD_SCALE.filter((b) => b.grade !== "F");
    expect(lookupGrade(39.5, scaleWithoutF)).toEqual({
      grade: "F",
      gradePoint: 0,
    });
  });
});

describe("computeResultFields (integer-hundredths score arithmetic)", () => {
  it("accurately adds floating point numbers (0.1 + 0.2 style) without IEEE-754 drift", () => {
    const res = computeResultFields(0.1, 0.2, STANDARD_SCALE);
    expect(res.totalScore).toBe(0.3);
    expect(res.grade).toBe("F");
    expect(res.gradePoint).toBe(0);
  });

  it("handles boundary totals exactly across grade boundaries", () => {
    // 39.99 -> F
    const r1 = computeResultFields(19.99, 20.0, STANDARD_SCALE);
    expect(r1).toEqual({ totalScore: 39.99, grade: "F", gradePoint: 0 });

    // 40.00 -> E
    const r2 = computeResultFields(20.0, 20.0, STANDARD_SCALE);
    expect(r2).toEqual({ totalScore: 40.0, grade: "E", gradePoint: 1 });

    // 44.99 -> E
    const r3 = computeResultFields(24.99, 20.0, STANDARD_SCALE);
    expect(r3).toEqual({ totalScore: 44.99, grade: "E", gradePoint: 1 });

    // 45.00 -> D
    const r4 = computeResultFields(25.0, 20.0, STANDARD_SCALE);
    expect(r4).toEqual({ totalScore: 45.0, grade: "D", gradePoint: 2 });

    // 69.99 -> B
    const r5 = computeResultFields(29.99, 40.0, STANDARD_SCALE);
    expect(r5).toEqual({ totalScore: 69.99, grade: "B", gradePoint: 4 });

    // 70.00 -> A
    const r6 = computeResultFields(30.0, 40.0, STANDARD_SCALE);
    expect(r6).toEqual({ totalScore: 70.0, grade: "A", gradePoint: 5 });
  });

  it("rejects CA scores outside 0..30 or with more than 2 decimals", () => {
    expect(() => computeResultFields(-0.01, 50, STANDARD_SCALE)).toThrow();
    expect(() => computeResultFields(30.01, 50, STANDARD_SCALE)).toThrow();
    expect(() => computeResultFields(15.123, 50, STANDARD_SCALE)).toThrow();
    expect(() => computeResultFields(NaN, 50, STANDARD_SCALE)).toThrow();
  });

  it("rejects Exam scores outside 0..70 or with more than 2 decimals", () => {
    expect(() => computeResultFields(20, -1, STANDARD_SCALE)).toThrow();
    expect(() => computeResultFields(20, 70.01, STANDARD_SCALE)).toThrow();
    expect(() => computeResultFields(20, 55.555, STANDARD_SCALE)).toThrow();
    expect(() => computeResultFields(20, Infinity, STANDARD_SCALE)).toThrow();
  });
});

describe("semesterGpa & cgpa (credit-unit weighted, rounded half-up)", () => {
  it("returns null when rows array is empty or total credit units is 0", () => {
    expect(semesterGpa([])).toBeNull();
    expect(cgpa([{ gradePoint: 5, creditUnits: 0 }])).toBeNull();
  });

  it("calculates a hand-computed weighted GPA example correctly", () => {
    // Course 1: 3 units, Grade A (5.0) -> 15.0 pts
    // Course 2: 4 units, Grade B (4.0) -> 16.0 pts
    // Course 3: 2 units, Grade C (3.0) -> 6.0 pts
    // Total units: 9, Total points: 37
    // 37 / 9 = 4.111111... -> rounded to 4.11
    const rows = [
      { gradePoint: 5, creditUnits: 3 },
      { gradePoint: 4, creditUnits: 4 },
      { gradePoint: 3, creditUnits: 2 },
    ];
    expect(semesterGpa(rows)).toBe(4.11);
    expect(cgpa(rows)).toBe(4.11);
  });

  it("correctly factors in F grades (0 grade points) pulling the average down", () => {
    // Course 1: 3 units, Grade A (5.0) -> 15.0 pts
    // Course 2: 3 units, Grade F (0.0) -> 0.0 pts
    // Total units: 6, Total points: 15
    // 15 / 6 = 2.50
    const rows = [
      { gradePoint: 5, creditUnits: 3 },
      { gradePoint: 0, creditUnits: 3 },
    ];
    expect(semesterGpa(rows)).toBe(2.5);
  });

  it("rounds half-up at x.xx5 boundaries", () => {
    // 3.455 -> 3.46
    expect(roundHalfUp2Decimals(3.455)).toBe(3.46);
    // 3.454 -> 3.45
    expect(roundHalfUp2Decimals(3.454)).toBe(3.45);
    // 4.125 -> 4.13
    expect(roundHalfUp2Decimals(4.125)).toBe(4.13);

    // Practical weighted case:
    // Course 1: 4 units, Grade Point 4 -> 16
    // Course 2: 4 units, Grade Point 5 -> 20
    // Course 3: 3 units, Grade Point 2 -> 6
    // Total points = 42, units = 11.
    // 42 / 11 = 3.818181... -> 3.82
    expect(
      semesterGpa([
        { gradePoint: 4, creditUnits: 4 },
        { gradePoint: 5, creditUnits: 4 },
        { gradePoint: 2, creditUnits: 3 },
      ])
    ).toBe(3.82);
  });
});

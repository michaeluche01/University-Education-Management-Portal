import { describe, expect, it } from "vitest";
import {
  lookupGrade,
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
    { score: 40, expectedGrade: "E", expectedPoint: 1 },
    { score: 44.9, expectedGrade: "E", expectedPoint: 1 },
    { score: 45, expectedGrade: "D", expectedPoint: 2 },
    { score: 69.5, expectedGrade: "B", expectedPoint: 4 },
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


import { describe, expect, it } from "vitest";
import {
  validateAndDeriveGradeScale,
  validateSessionName,
} from "../../src/lib/validators/structure";

describe("validateSessionName", () => {
  it("accepts valid consecutive YYYY/YYYY session names", () => {
    expect(validateSessionName("2025/2026")).toEqual({ valid: true });
    expect(validateSessionName("2026/2027")).toEqual({ valid: true });
  });

  it("rejects non-YYYY/YYYY formats and non-consecutive years", () => {
    expect(validateSessionName("2026-2027").valid).toBe(false);
    expect(validateSessionName("26/27").valid).toBe(false);
    expect(validateSessionName("2026/2026").valid).toBe(false);
    expect(validateSessionName("2026/2028").valid).toBe(false);
    expect(validateSessionName("2027/2026").valid).toBe(false);
  });
});

describe("validateAndDeriveGradeScale", () => {
  const validInput = [
    { grade: "a", minScore: 70, gradePoint: 5, remark: "Excellent" },
    { grade: "B", minScore: 60, gradePoint: 4, remark: "Very Good" },
    { grade: "C", minScore: 50, gradePoint: 3, remark: "Good" },
    { grade: "D", minScore: 45, gradePoint: 2, remark: "Fair" },
    { grade: "E", minScore: 40, gradePoint: 1, remark: "Pass" },
    { grade: "F", minScore: 0, gradePoint: 0, remark: "Fail" },
  ];

  it("derives contiguous maxScore values with top band = 100", () => {
    const res = validateAndDeriveGradeScale(validInput);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.rows).toEqual([
        {
          grade: "A",
          minScore: 70,
          maxScore: 100,
          gradePoint: 5,
          remark: "Excellent",
        },
        {
          grade: "B",
          minScore: 60,
          maxScore: 69,
          gradePoint: 4,
          remark: "Very Good",
        },
        {
          grade: "C",
          minScore: 50,
          maxScore: 59,
          gradePoint: 3,
          remark: "Good",
        },
        {
          grade: "D",
          minScore: 45,
          maxScore: 49,
          gradePoint: 2,
          remark: "Fair",
        },
        {
          grade: "E",
          minScore: 40,
          maxScore: 44,
          gradePoint: 1,
          remark: "Pass",
        },
        {
          grade: "F",
          minScore: 0,
          maxScore: 39,
          gradePoint: 0,
          remark: "Fail",
        },
      ]);
    }
  });

  it("rejects fewer than 2 bands", () => {
    const res = validateAndDeriveGradeScale([
      { grade: "A", minScore: 0, gradePoint: 5, remark: "Pass" },
    ]);
    expect(res.valid).toBe(false);
  });

  it("rejects missing minScore = 0 band", () => {
    const withoutZero = validInput.filter((b) => b.minScore !== 0);
    const res = validateAndDeriveGradeScale(withoutZero);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.errors.join(" ")).toContain("minScore = 0");
    }
  });

  it("rejects duplicate grades or duplicate minScores", () => {
    const dupGrade = [
      { grade: "A", minScore: 70, gradePoint: 5, remark: "Excellent" },
      { grade: "A", minScore: 0, gradePoint: 0, remark: "Fail" },
    ];
    expect(validateAndDeriveGradeScale(dupGrade).valid).toBe(false);

    const dupMin = [
      { grade: "A", minScore: 0, gradePoint: 5, remark: "Excellent" },
      { grade: "F", minScore: 0, gradePoint: 0, remark: "Fail" },
    ];
    expect(validateAndDeriveGradeScale(dupMin).valid).toBe(false);
  });

  it("rejects inverted gradePoint order (higher minScore with lower gradePoint)", () => {
    const inverted = [
      { grade: "A", minScore: 70, gradePoint: 3, remark: "High score low pt" },
      { grade: "B", minScore: 50, gradePoint: 4, remark: "Mid score high pt" },
      { grade: "F", minScore: 0, gradePoint: 0, remark: "Fail" },
    ];
    const res = validateAndDeriveGradeScale(inverted);
    expect(res.valid).toBe(false);
  });

  it("rejects non-integer minScores or out-of-range gradePoints", () => {
    const floatMin = [
      { grade: "A", minScore: 69.5, gradePoint: 5, remark: "Excellent" },
      { grade: "F", minScore: 0, gradePoint: 0, remark: "Fail" },
    ];
    expect(validateAndDeriveGradeScale(floatMin).valid).toBe(false);

    const badPoint = [
      { grade: "A", minScore: 70, gradePoint: 6, remark: "Too high" },
      { grade: "F", minScore: 0, gradePoint: 0, remark: "Fail" },
    ];
    expect(validateAndDeriveGradeScale(badPoint).valid).toBe(false);
  });
});


import { describe, expect, it } from "vitest";
import {
  createCourseAssignmentSchema,
  createCourseSchema,
  normalizeCourseCode,
  updateCourseSchema,
} from "@/lib/validators/course";

describe("Course Validators & Code Normalisation", () => {
  it("normalizes course codes by trimming, collapsing spaces, and uppercasing", () => {
    expect(normalizeCourseCode("csc  301")).toBe("CSC 301");
    expect(normalizeCourseCode("  mth   101a  ")).toBe("MTH 101A");
    expect(normalizeCourseCode("EEE\t\n201")).toBe("EEE 201");
  });

  it("validates createCourseSchema and normalizes code", () => {
    const parsed = createCourseSchema.parse({
      code: "  csc   311 ",
      title: "Artificial Intelligence",
      creditUnits: 3,
      programId: "prog-1",
      levelId: "lvl-300",
      semesterName: "FIRST",
    });
    expect(parsed.code).toBe("CSC 311");
    expect(parsed.creditUnits).toBe(3);
    expect(parsed.isActive).toBe(true);
  });

  it("rejects creditUnits outside 1..6", () => {
    expect(
      createCourseSchema.safeParse({
        code: "CSC 311",
        title: "AI",
        creditUnits: 0,
        programId: "prog-1",
        levelId: "lvl-300",
        semesterName: "FIRST",
      }).success
    ).toBe(false);

    expect(
      createCourseSchema.safeParse({
        code: "CSC 311",
        title: "Artificial Intelligence",
        creditUnits: 7,
        programId: "prog-1",
        levelId: "lvl-300",
        semesterName: "FIRST",
      }).success
    ).toBe(false);
  });

  it("rejects unknown fields on strict course and assignment schemas", () => {
    expect(
      createCourseSchema.safeParse({
        code: "CSC 311",
        title: "Artificial Intelligence",
        creditUnits: 3,
        programId: "prog-1",
        levelId: "lvl-300",
        semesterName: "FIRST",
        role: "SUPER_ADMIN",
      }).success
    ).toBe(false);

    expect(
      updateCourseSchema.safeParse({
        title: "Updated Title",
        userId: "smuggled-id",
      }).success
    ).toBe(false);

    expect(
      createCourseAssignmentSchema.safeParse({
        courseId: "c1",
        lecturerId: "l1",
        semesterId: "s1",
        departmentId: "d1",
      }).success
    ).toBe(false);
  });
});

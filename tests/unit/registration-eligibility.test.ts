import { describe, expect, it } from "vitest";
import {
  createRegistrationBatchSchema,
  evaluateCourseEligibility,
} from "../../src/lib/validators/registration";

const BASE_STUDENT = {
  departmentId: "dept-csc",
  programId: "prog-bsc-csc",
  levelId: "lvl-300",
};

const BASE_COURSE = {
  id: "course-csc301",
  code: "CSC 301",
  isActive: true,
  departmentId: "dept-csc",
  programId: "prog-bsc-csc",
  levelId: "lvl-300",
  semesterName: "FIRST" as const,
};

const OPEN_FIRST_SEMESTER = {
  id: "sem-first",
  name: "FIRST" as const,
  registrationOpen: true,
};

describe("Course Registration Eligibility & Batch Schema Unit Tests", () => {
  it("allows an active course matching department, program, level, and open current semester", () => {
    const res = evaluateCourseEligibility(
      BASE_STUDENT,
      BASE_COURSE,
      OPEN_FIRST_SEMESTER,
      false
    );
    expect(res).toEqual({ eligible: true });
  });

  it("rejects when there is no current semester or registration is closed", () => {
    expect(
      evaluateCourseEligibility(BASE_STUDENT, BASE_COURSE, null, false)
    ).toMatchObject({
      eligible: false,
      code: "NO_CURRENT_SEMESTER",
    });

    expect(
      evaluateCourseEligibility(
        BASE_STUDENT,
        BASE_COURSE,
        { ...OPEN_FIRST_SEMESTER, registrationOpen: false },
        false
      )
    ).toMatchObject({
      eligible: false,
      code: "REGISTRATION_CLOSED",
    });
  });

  it("rejects inactive courses and department/program/level/semester mismatches", () => {
    expect(
      evaluateCourseEligibility(
        BASE_STUDENT,
        { ...BASE_COURSE, isActive: false },
        OPEN_FIRST_SEMESTER,
        false
      )
    ).toMatchObject({
      eligible: false,
      code: "COURSE_INACTIVE",
    });

    expect(
      evaluateCourseEligibility(
        BASE_STUDENT,
        { ...BASE_COURSE, departmentId: "dept-mth" },
        OPEN_FIRST_SEMESTER,
        false
      )
    ).toMatchObject({
      eligible: false,
      code: "DEPARTMENT_MISMATCH",
    });

    expect(
      evaluateCourseEligibility(
        BASE_STUDENT,
        { ...BASE_COURSE, programId: "prog-bsc-mth" },
        OPEN_FIRST_SEMESTER,
        false
      )
    ).toMatchObject({
      eligible: false,
      code: "PROGRAM_MISMATCH",
    });

    expect(
      evaluateCourseEligibility(
        BASE_STUDENT,
        { ...BASE_COURSE, levelId: "lvl-200" },
        OPEN_FIRST_SEMESTER,
        false
      )
    ).toMatchObject({
      eligible: false,
      code: "LEVEL_MISMATCH",
    });

    expect(
      evaluateCourseEligibility(
        BASE_STUDENT,
        { ...BASE_COURSE, semesterName: "SECOND" },
        OPEN_FIRST_SEMESTER,
        false
      )
    ).toMatchObject({
      eligible: false,
      code: "SEMESTER_MISMATCH",
    });
  });

  it("rejects already-registered courses and duplicate or unknown fields in batch schema", () => {
    expect(
      evaluateCourseEligibility(
        BASE_STUDENT,
        BASE_COURSE,
        OPEN_FIRST_SEMESTER,
        true
      )
    ).toMatchObject({
      eligible: false,
      code: "ALREADY_REGISTERED",
    });

    // Duplicate courseIds in batch -> fails validation
    expect(
      createRegistrationBatchSchema.safeParse({
        courseIds: ["c1", "c1"],
      }).success
    ).toBe(false);

    // Unknown smuggled field -> fails strict validation
    expect(
      createRegistrationBatchSchema.safeParse({
        courseIds: ["c1"],
        studentId: "smuggled-student-id",
      }).success
    ).toBe(false);
  });
});


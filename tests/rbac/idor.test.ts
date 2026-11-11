import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { ApiTestClient } from "./helpers";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

describe("Insecure Direct Object Reference (IDOR) Protection Suite", { timeout: 90000 }, () => {
  const cscAdmin = new ApiTestClient();
  const mthAdmin = new ApiTestClient();
  const lecturer1 = new ApiTestClient(); // assigned to CSC 101, 201, 202
  const lecturer2 = new ApiTestClient(); // assigned to CSC 102, 301
  const student01 = new ApiTestClient(); // CSC student
  const student02 = new ApiTestClient(); // CSC student

  let cscProgramId = "";
  let mthProgramId = "";
  let mthCourseId = "";
  let mthAssignmentId = "";
  let mthStudentId = "";
  let mthLecturerId = "";
  let student01RegistrationId = "";
  let cscResultId = "";

  beforeAll(async () => {
    const [cRes, mRes, l1Res, l2Res, s1Res, s2Res] = await Promise.all([
      cscAdmin.login("deptadmin.csc@uemp.demo", "Uemp@Demo2026"),
      mthAdmin.login("deptadmin.mth@uemp.demo", "Uemp@Demo2026"),
      lecturer1.login("lecturer1@uemp.demo", "Uemp@Demo2026"),
      lecturer2.login("lecturer2@uemp.demo", "Uemp@Demo2026"),
      student01.login("student01@uemp.demo", "Uemp@Demo2026"),
      student02.login("student02@uemp.demo", "Uemp@Demo2026"),
    ]);

    expect(cRes.status).toBe(200);
    expect(mRes.status).toBe(200);
    expect(l1Res.status).toBe(200);
    expect(l2Res.status).toBe(200);
    expect(s1Res.status).toBe(200);
    expect(s2Res.status).toBe(200);

    const [
      cscProg,
      mthProg,
      cscCourse,
      mthCourse,
      cscLec,
      mthLec,
      cscStu,
      mthStu,
    ] = await Promise.all([
      prisma.program.findUniqueOrThrow({ where: { code: "BSC-CSC" } }),
      prisma.program.findUniqueOrThrow({ where: { code: "BSC-MTH" } }),
      prisma.course.findUniqueOrThrow({ where: { code: "CSC 101" } }),
      prisma.course.findUniqueOrThrow({ where: { code: "MTH 101" } }),
      prisma.lecturer.findFirstOrThrow({ where: { staffId: "STAFF/CSC/001" } }),
      prisma.lecturer.findFirstOrThrow({ where: { staffId: "STAFF/MTH/001" } }),
      prisma.student.findFirstOrThrow({ where: { department: { code: "CSC" } } }),
      prisma.student.findFirstOrThrow({ where: { department: { code: "MTH" } } }),
    ]);

    const [cscAssign, mthAssign, s1Reg, cscResItem] = await Promise.all([
      prisma.courseAssignment.findFirstOrThrow({ where: { courseId: cscCourse.id } }),
      prisma.courseAssignment.findFirstOrThrow({
        where: { course: { department: { code: "MTH" } } },
      }),
      prisma.courseRegistration.findFirstOrThrow({
        where: { studentId: cscStu.id },
      }),
      prisma.result.findFirstOrThrow({ where: { courseId: cscCourse.id } }),
    ]);

    cscProgramId = cscProg.id;
    mthProgramId = mthProg.id;
    mthCourseId = mthCourse.id;
    mthAssignmentId = mthAssign.id;
    mthStudentId = mthStu.id;
    mthLecturerId = mthLec.id;
    student01RegistrationId = s1Reg.id;
    cscResultId = cscResItem.id;
  }, 90000);

  describe("1. Department Isolation IDOR Checks", () => {
    it("rejects CSC admin attempting to PATCH an MTH program with 403", async () => {
      const res = await cscAdmin.request(`/api/v1/programs/${mthProgramId}`, {
        method: "PATCH",
        body: JSON.stringify({ durationYears: 4 }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects MTH admin attempting to PATCH a CSC program with 403", async () => {
      const res = await mthAdmin.request(`/api/v1/programs/${cscProgramId}`, {
        method: "PATCH",
        body: JSON.stringify({ durationYears: 4 }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects CSC admin attempting to PATCH an MTH course with 403", async () => {
      const res = await cscAdmin.request(`/api/v1/courses/${mthCourseId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Renamed MTH Course" }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects CSC admin attempting to DELETE an MTH course assignment with 403", async () => {
      const res = await cscAdmin.request(
        `/api/v1/course-assignments/${mthAssignmentId}`,
        { method: "DELETE" }
      );
      expect(res.status).toBe(403);
    });

    it("rejects CSC admin attempting to GET or PATCH an MTH student with 403", async () => {
      const getRes = await cscAdmin.request(`/api/v1/students/${mthStudentId}`);
      expect(getRes.status).toBe(403);

      const patchRes = await cscAdmin.request(`/api/v1/students/${mthStudentId}`, {
        method: "PATCH",
        body: JSON.stringify({ fullName: "Attacked Student" }),
      });
      expect(patchRes.status).toBe(403);
    });

    it("rejects CSC admin attempting to GET or PATCH an MTH lecturer with 403", async () => {
      const getRes = await cscAdmin.request(`/api/v1/lecturers/${mthLecturerId}`);
      expect(getRes.status).toBe(403);

      const patchRes = await cscAdmin.request(`/api/v1/lecturers/${mthLecturerId}`, {
        method: "PATCH",
        body: JSON.stringify({ fullName: "Attacked Lecturer" }),
      });
      expect(patchRes.status).toBe(403);
    });
  });

  describe("2. Student Registration IDOR Checks", () => {
    it("rejects student02 attempting to DELETE student01's registration with 403 or 404", async () => {
      const res = await student02.request(
        `/api/v1/registrations/${student01RegistrationId}`,
        { method: "DELETE" }
      );
      // Student cannot drop another student's registration
      expect([403, 404].includes(res.status)).toBe(true);
    });
  });

  describe("3. Lecturer & Result Audit History IDOR Checks", () => {
    it("rejects an unassigned lecturer from viewing result audit history with 403", async () => {
      // lecturer2 is NOT assigned to CSC 101
      const res = await lecturer2.request(
        `/api/v1/results/${cscResultId}/history`
      );
      expect(res.status).toBe(403);
    });

    it("rejects an out-of-scope department admin from viewing result history with 403", async () => {
      // mthAdmin cannot view CSC result history
      const res = await mthAdmin.request(
        `/api/v1/results/${cscResultId}/history`
      );
      expect(res.status).toBe(403);
    });
  });
});

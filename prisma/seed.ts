import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type {
  AuditAction,
  ResultStatus,
  Role,
  SemesterName,
} from "../src/generated/prisma/enums";
import { lookupGrade } from "../src/server/services/grading.service";

function checkProdSafety() {
  if (process.env.CONFIRM_PROD === "yes") {
    return;
  }
  const prodHostsRaw = process.env.PROD_DB_HOST;
  if (!prodHostsRaw) {
    return;
  }
  const prodHosts = prodHostsRaw
    .split(/[,\s]+/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  for (const envKey of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const rawUrl = process.env[envKey];
    if (!rawUrl) continue;
    try {
      const host = new URL(rawUrl).hostname.toLowerCase();
      if (prodHosts.some((ph) => host === ph || host.includes(ph))) {
        console.error(
          `[seed] Refusing to run: ${envKey} host (${host}) matches PROD_DB_HOST and CONFIRM_PROD=yes is not set.`
        );
        process.exit(1);
      }
    } catch {
      // ignore URL parse error here
    }
  }
}

export async function seed(prismaOverride?: PrismaClient) {
  checkProdSafety();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const prisma =
    prismaOverride ??
    new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const passwordHash = await bcrypt.hash("Uemp@Demo2026", 10);

    // 1. GradeScale (Decision D1 in REQUIREMENTS.md §14)
    const gradeBands = [
      {
        grade: "A",
        minScore: 70,
        maxScore: 100,
        gradePoint: 5.0,
        remark: "Excellent",
      },
      {
        grade: "B",
        minScore: 60,
        maxScore: 69,
        gradePoint: 4.0,
        remark: "Very Good",
      },
      {
        grade: "C",
        minScore: 50,
        maxScore: 59,
        gradePoint: 3.0,
        remark: "Good",
      },
      {
        grade: "D",
        minScore: 45,
        maxScore: 49,
        gradePoint: 2.0,
        remark: "Fair",
      },
      {
        grade: "E",
        minScore: 40,
        maxScore: 44,
        gradePoint: 1.0,
        remark: "Pass",
      },
      {
        grade: "F",
        minScore: 0,
        maxScore: 39,
        gradePoint: 0.0,
        remark: "Fail",
      },
    ];

    for (const band of gradeBands) {
      await prisma.gradeScale.upsert({
        where: { grade: band.grade },
        update: {
          minScore: band.minScore,
          maxScore: band.maxScore,
          gradePoint: band.gradePoint,
          remark: band.remark,
        },
        create: band,
      });
    }

    const scaleRows = await prisma.gradeScale.findMany();

    // 2. Academic Levels (100 - 400)
    const levelsData = [
      { levelNumber: 100, name: "100 Level" },
      { levelNumber: 200, name: "200 Level" },
      { levelNumber: 300, name: "300 Level" },
      { levelNumber: 400, name: "400 Level" },
    ];
    const levelsByNum: Record<number, { id: string; levelNumber: number }> = {};
    for (const lvl of levelsData) {
      const record = await prisma.academicLevel.upsert({
        where: { levelNumber: lvl.levelNumber },
        update: { name: lvl.name },
        create: lvl,
      });
      levelsByNum[lvl.levelNumber] = record;
    }

    // 3. Faculties (2) & Departments (4) & Programs (4)
    const facScience = await prisma.faculty.upsert({
      where: { code: "FSC" },
      update: {
        name: "Faculty of Science",
        description: "Natural, Mathematical, and Computing Sciences",
      },
      create: {
        name: "Faculty of Science",
        code: "FSC",
        description: "Natural, Mathematical, and Computing Sciences",
      },
    });

    const facEngineering = await prisma.faculty.upsert({
      where: { code: "FENG" },
      update: {
        name: "Faculty of Engineering",
        description: "Electrical, Civil, and Infrastructure Engineering",
      },
      create: {
        name: "Faculty of Engineering",
        code: "FENG",
        description: "Electrical, Civil, and Infrastructure Engineering",
      },
    });

    const deptSpecs = [
      {
        code: "CSC",
        name: "Computer Science",
        facultyId: facScience.id,
        programCode: "BSC-CSC",
        programName: "B.Sc. Computer Science",
        durationYears: 4,
      },
      {
        code: "MTH",
        name: "Mathematics",
        facultyId: facScience.id,
        programCode: "BSC-MTH",
        programName: "B.Sc. Mathematics",
        durationYears: 4,
      },
      {
        code: "EEE",
        name: "Electrical Engineering",
        facultyId: facEngineering.id,
        programCode: "BENG-EEE",
        programName: "B.Eng. Electrical Engineering",
        durationYears: 5,
      },
      {
        code: "CVE",
        name: "Civil Engineering",
        facultyId: facEngineering.id,
        programCode: "BENG-CVE",
        programName: "B.Eng. Civil Engineering",
        durationYears: 5,
      },
    ];

    const depts: Record<string, { id: string; code: string }> = {};
    const programs: Record<string, { id: string; code: string }> = {};

    for (const d of deptSpecs) {
      const dept = await prisma.department.upsert({
        where: { code: d.code },
        update: { name: d.name, facultyId: d.facultyId },
        create: { code: d.code, name: d.name, facultyId: d.facultyId },
      });
      depts[d.code] = dept;

      const prog = await prisma.program.upsert({
        where: { code: d.programCode },
        update: {
          name: d.programName,
          durationYears: d.durationYears,
          departmentId: dept.id,
        },
        create: {
          code: d.programCode,
          name: d.programName,
          durationYears: d.durationYears,
          departmentId: dept.id,
        },
      });
      programs[d.code] = prog;
    }

    // 4. Academic Sessions & Semesters
    // Ensure previous session is not current before setting 2026/2027 as current
    const prevSession = await prisma.academicSession.upsert({
      where: { name: "2025/2026" },
      update: {
        startDate: new Date("2025-09-01T00:00:00.000Z"),
        endDate: new Date("2026-07-31T23:59:59.000Z"),
        isCurrent: false,
      },
      create: {
        name: "2025/2026",
        startDate: new Date("2025-09-01T00:00:00.000Z"),
        endDate: new Date("2026-07-31T23:59:59.000Z"),
        isCurrent: false,
      },
    });

    const prevFirstSem = await prisma.semester.upsert({
      where: {
        sessionId_name: { sessionId: prevSession.id, name: "FIRST" },
      },
      update: { isCurrent: false, registrationOpen: false },
      create: {
        sessionId: prevSession.id,
        name: "FIRST",
        isCurrent: false,
        registrationOpen: false,
      },
    });

    const prevSecondSem = await prisma.semester.upsert({
      where: {
        sessionId_name: { sessionId: prevSession.id, name: "SECOND" },
      },
      update: { isCurrent: false, registrationOpen: false },
      create: {
        sessionId: prevSession.id,
        name: "SECOND",
        isCurrent: false,
        registrationOpen: false,
      },
    });

    const currSession = await prisma.academicSession.upsert({
      where: { name: "2026/2027" },
      update: {
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2027-07-31T23:59:59.000Z"),
        isCurrent: true,
      },
      create: {
        name: "2026/2027",
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2027-07-31T23:59:59.000Z"),
        isCurrent: true,
      },
    });

    const currFirstSem = await prisma.semester.upsert({
      where: {
        sessionId_name: { sessionId: currSession.id, name: "FIRST" },
      },
      update: { isCurrent: true, registrationOpen: true },
      create: {
        sessionId: currSession.id,
        name: "FIRST",
        isCurrent: true,
        registrationOpen: true,
      },
    });

    await prisma.semester.upsert({
      where: {
        sessionId_name: { sessionId: currSession.id, name: "SECOND" },
      },
      update: { isCurrent: false, registrationOpen: false },
      create: {
        sessionId: currSession.id,
        name: "SECOND",
        isCurrent: false,
        registrationOpen: false,
      },
    });

    // 5. Users: 1 Super Admin, 2 Dept Admins, 4 Lecturers, 24 Students
    await prisma.user.upsert({
      where: { email: "superadmin@uemp.demo" },
      update: {
        fullName: "Prof. Adewale Ogunleye",
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
      create: {
        email: "superadmin@uemp.demo",
        fullName: "Prof. Adewale Ogunleye",
        passwordHash,
        phone: "+2348010000001",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });

    const cscAdminUser = await prisma.user.upsert({
      where: { email: "deptadmin.csc@uemp.demo" },
      update: {
        fullName: "Dr. Ngozi Eze",
        passwordHash,
        role: "DEPARTMENT_ADMIN",
        status: "ACTIVE",
      },
      create: {
        email: "deptadmin.csc@uemp.demo",
        fullName: "Dr. Ngozi Eze",
        passwordHash,
        phone: "+2348010000002",
        role: "DEPARTMENT_ADMIN",
        status: "ACTIVE",
      },
    });

    await prisma.departmentAdmin.upsert({
      where: { userId: cscAdminUser.id },
      update: {
        departmentId: depts.CSC.id,
        staffId: "ADMIN/CSC/001",
      },
      create: {
        userId: cscAdminUser.id,
        departmentId: depts.CSC.id,
        staffId: "ADMIN/CSC/001",
      },
    });

    const mthAdminUser = await prisma.user.upsert({
      where: { email: "deptadmin.mth@uemp.demo" },
      update: {
        fullName: "Dr. Ibrahim Musa",
        passwordHash,
        role: "DEPARTMENT_ADMIN",
        status: "ACTIVE",
      },
      create: {
        email: "deptadmin.mth@uemp.demo",
        fullName: "Dr. Ibrahim Musa",
        passwordHash,
        phone: "+2348010000003",
        role: "DEPARTMENT_ADMIN",
        status: "ACTIVE",
      },
    });

    await prisma.departmentAdmin.upsert({
      where: { userId: mthAdminUser.id },
      update: {
        departmentId: depts.MTH.id,
        staffId: "ADMIN/MTH/001",
      },
      create: {
        userId: mthAdminUser.id,
        departmentId: depts.MTH.id,
        staffId: "ADMIN/MTH/001",
      },
    });

    // 4 Lecturers (3 in CSC, 1 in MTH)
    const lecturerSpecs = [
      {
        email: "lecturer1@uemp.demo",
        fullName: "Dr. Chinedu Okonkwo",
        staffId: "STAFF/CSC/001",
        deptCode: "CSC",
        title: "Dr.",
        specialization: "Algorithms & Systems Programming",
      },
      {
        email: "lecturer2@uemp.demo",
        fullName: "Dr. Amina Bello",
        staffId: "STAFF/CSC/002",
        deptCode: "CSC",
        title: "Dr.",
        specialization: "Databases & Computer Networks",
      },
      {
        email: "lecturer3@uemp.demo",
        fullName: "Prof. Tunde Bakare",
        staffId: "STAFF/CSC/003",
        deptCode: "CSC",
        title: "Prof.",
        specialization: "Software Engineering & Compilers",
      },
      {
        email: "lecturer4@uemp.demo",
        fullName: "Dr. Zainab Danjuma",
        staffId: "STAFF/MTH/001",
        deptCode: "MTH",
        title: "Dr.",
        specialization: "Applied Mathematics & Linear Algebra",
      },
    ];

    const lecturers: Record<string, { id: string; userId: string }> = {};

    for (const [idx, spec] of lecturerSpecs.entries()) {
      const user = await prisma.user.upsert({
        where: { email: spec.email },
        update: {
          fullName: spec.fullName,
          passwordHash,
          role: "LECTURER",
          status: "ACTIVE",
        },
        create: {
          email: spec.email,
          fullName: spec.fullName,
          passwordHash,
          phone: `+234802000000${idx + 1}`,
          role: "LECTURER",
          status: "ACTIVE",
        },
      });

      const lecturer = await prisma.lecturer.upsert({
        where: { userId: user.id },
        update: {
          staffId: spec.staffId,
          departmentId: depts[spec.deptCode].id,
          title: spec.title,
          specialization: spec.specialization,
        },
        create: {
          userId: user.id,
          staffId: spec.staffId,
          departmentId: depts[spec.deptCode].id,
          title: spec.title,
          specialization: spec.specialization,
        },
      });

      lecturers[`lecturer${idx + 1}`] = { id: lecturer.id, userId: user.id };
    }

    // 24 Students (student01..student24@uemp.demo)
    const studentNames = [
      "Oluwaseun Adeyemi",
      "Chioma Nwachukwu",
      "Abdullahi Abubakar",
      "Nneka Okafor",
      "Babajide Sanusi",
      "Fatima Lawal",
      "Emeka Obi",
      "Halima Suleiman",
      "Tosin Akintola",
      "Kelechi Iheanacho",
      "Sadiq Usman",
      "Blessing Eze",
      "Damilola Ojo",
      "Yusuf Garba",
      "Adaeze Nwosu",
      "Segun Oladipo",
      "Zainab Aliyu",
      "Chukwudi Eze",
      "Aisha Mohammed",
      "Victor Olayinka",
      "Hauwa Bello",
      "Gideon Nwankwo",
      "Samuel Afolabi",
      "Miriam Danladi",
    ];

    interface StudentSeedSpec {
      index: number;
      email: string;
      fullName: string;
      matricNumber: string;
      deptCode: "CSC" | "MTH" | "EEE";
      levelNum: 100 | 200 | 300 | 400;
    }

    const studentSpecs: StudentSeedSpec[] = studentNames.map((fullName, i) => {
      const num = i + 1;
      const padded = String(num).padStart(2, "0");
      const matricSeq = String(num).padStart(3, "0");

      if (num <= 10) {
        // 10 students in CSC 300L (student01..student10)
        return {
          index: num,
          email: `student${padded}@uemp.demo`,
          fullName,
          matricNumber: `UEMP/2024/CSC/${matricSeq}`,
          deptCode: "CSC",
          levelNum: 300,
        };
      }
      if (num <= 14) {
        // 4 students in CSC 200L (student11..student14)
        return {
          index: num,
          email: `student${padded}@uemp.demo`,
          fullName,
          matricNumber: `UEMP/2025/CSC/${matricSeq}`,
          deptCode: "CSC",
          levelNum: 200,
        };
      }
      if (num <= 16) {
        // 2 students in CSC 100L (student15..student16)
        return {
          index: num,
          email: `student${padded}@uemp.demo`,
          fullName,
          matricNumber: `UEMP/2026/CSC/${matricSeq}`,
          deptCode: "CSC",
          levelNum: 100,
        };
      }
      if (num <= 18) {
        // 2 students in CSC 400L (student17..student18)
        return {
          index: num,
          email: `student${padded}@uemp.demo`,
          fullName,
          matricNumber: `UEMP/2023/CSC/${matricSeq}`,
          deptCode: "CSC",
          levelNum: 400,
        };
      }
      if (num <= 22) {
        // 4 students in MTH 200L (student19..student22)
        return {
          index: num,
          email: `student${padded}@uemp.demo`,
          fullName,
          matricNumber: `UEMP/2025/MTH/${matricSeq}`,
          deptCode: "MTH",
          levelNum: 200,
        };
      }
      // 2 students in EEE 200L (student23..student24)
      return {
        index: num,
        email: `student${padded}@uemp.demo`,
        fullName,
        matricNumber: `UEMP/2025/EEE/${matricSeq}`,
        deptCode: "EEE",
        levelNum: 200,
      };
    });

    const studentsByIndex: Record<
      number,
      { id: string; userId: string; email: string; matricNumber: string }
    > = {};

    await Promise.all(
      studentSpecs.map(async (spec) => {
        const user = await prisma.user.upsert({
          where: { email: spec.email },
          update: {
            fullName: spec.fullName,
            passwordHash,
            role: "STUDENT",
            status: "ACTIVE",
          },
          create: {
            email: spec.email,
            fullName: spec.fullName,
            passwordHash,
            phone: `+23480300000${String(spec.index).padStart(2, "0")}`,
            role: "STUDENT",
            status: "ACTIVE",
          },
        });

        const student = await prisma.student.upsert({
          where: { userId: user.id },
          update: {
            matricNumber: spec.matricNumber,
            departmentId: depts[spec.deptCode].id,
            programId: programs[spec.deptCode].id,
            levelId: levelsByNum[spec.levelNum].id,
          },
          create: {
            userId: user.id,
            matricNumber: spec.matricNumber,
            departmentId: depts[spec.deptCode].id,
            programId: programs[spec.deptCode].id,
            levelId: levelsByNum[spec.levelNum].id,
            gender: spec.index % 2 === 0 ? "Female" : "Male",
            address: "University Student Hostel, Abuja",
          },
        });

        studentsByIndex[spec.index] = {
          id: student.id,
          userId: user.id,
          email: spec.email,
          matricNumber: spec.matricNumber,
        };
      })
    );

    // 6. Courses (14 FIRST semester + 4 previous-history courses)
    interface CourseSeedSpec {
      code: string;
      title: string;
      creditUnits: number;
      deptCode: "CSC" | "MTH" | "EEE" | "CVE";
      levelNum: 100 | 200 | 300 | 400;
      semesterName: SemesterName;
      lecturerKey?: "lecturer1" | "lecturer2" | "lecturer3" | "lecturer4";
    }

    const courseSpecs: CourseSeedSpec[] = [
      // CSC 300L Current FIRST Semester (Scenarios S1..S5)
      {
        code: "CSC 301",
        title: "Data Structures and Algorithms",
        creditUnits: 3,
        deptCode: "CSC",
        levelNum: 300,
        semesterName: "FIRST",
        lecturerKey: "lecturer1",
      },
      {
        code: "CSC 303",
        title: "Operating Systems",
        creditUnits: 3,
        deptCode: "CSC",
        levelNum: 300,
        semesterName: "FIRST",
        lecturerKey: "lecturer1",
      },
      {
        code: "CSC 305",
        title: "Database Management Systems",
        creditUnits: 3,
        deptCode: "CSC",
        levelNum: 300,
        semesterName: "FIRST",
        lecturerKey: "lecturer2",
      },
      {
        code: "CSC 307",
        title: "Computer Networks",
        creditUnits: 3,
        deptCode: "CSC",
        levelNum: 300,
        semesterName: "FIRST",
        lecturerKey: "lecturer2",
      },
      {
        code: "CSC 309",
        title: "Software Engineering",
        creditUnits: 2,
        deptCode: "CSC",
        levelNum: 300,
        semesterName: "FIRST",
        lecturerKey: "lecturer3",
      },
      // CSC 200L FIRST
      {
        code: "CSC 201",
        title: "Computer Programming I",
        creditUnits: 3,
        deptCode: "CSC",
        levelNum: 200,
        semesterName: "FIRST",
        lecturerKey: "lecturer1",
      },
      {
        code: "CSC 203",
        title: "Discrete Structures",
        creditUnits: 2,
        deptCode: "CSC",
        levelNum: 200,
        semesterName: "FIRST",
        lecturerKey: "lecturer3",
      },
      // CSC 100L FIRST
      {
        code: "CSC 101",
        title: "Introduction to Computer Science",
        creditUnits: 3,
        deptCode: "CSC",
        levelNum: 100,
        semesterName: "FIRST",
        lecturerKey: "lecturer2",
      },
      {
        code: "CSC 103",
        title: "Fundamentals of Computing",
        creditUnits: 2,
        deptCode: "CSC",
        levelNum: 100,
        semesterName: "FIRST",
        lecturerKey: "lecturer3",
      },
      // CSC 400L FIRST
      {
        code: "CSC 401",
        title: "Compiler Construction",
        creditUnits: 3,
        deptCode: "CSC",
        levelNum: 400,
        semesterName: "FIRST",
        lecturerKey: "lecturer1",
      },
      // MTH 200L FIRST (Scenario S6)
      {
        code: "MTH 201",
        title: "Mathematical Methods I",
        creditUnits: 3,
        deptCode: "MTH",
        levelNum: 200,
        semesterName: "FIRST",
        lecturerKey: "lecturer4",
      },
      {
        code: "MTH 203",
        title: "Linear Algebra I",
        creditUnits: 2,
        deptCode: "MTH",
        levelNum: 200,
        semesterName: "FIRST",
        lecturerKey: "lecturer4",
      },
      // EEE 200L & CVE 200L FIRST
      {
        code: "EEE 201",
        title: "Applied Electricity I",
        creditUnits: 3,
        deptCode: "EEE",
        levelNum: 200,
        semesterName: "FIRST",
        lecturerKey: "lecturer3",
      },
      {
        code: "CVE 201",
        title: "Strength of Materials I",
        creditUnits: 3,
        deptCode: "CVE",
        levelNum: 200,
        semesterName: "FIRST",
        lecturerKey: "lecturer3",
      },
      // Previous session (2025/2026) history courses
      {
        code: "CSC 102",
        title: "Introduction to Problem Solving",
        creditUnits: 3,
        deptCode: "CSC",
        levelNum: 100,
        semesterName: "SECOND",
      },
      {
        code: "CSC 202",
        title: "Computer Programming II",
        creditUnits: 3,
        deptCode: "CSC",
        levelNum: 200,
        semesterName: "SECOND",
      },
      {
        code: "MTH 101",
        title: "Elementary Mathematics I",
        creditUnits: 3,
        deptCode: "MTH",
        levelNum: 100,
        semesterName: "FIRST",
      },
      {
        code: "MTH 102",
        title: "Elementary Mathematics II",
        creditUnits: 3,
        deptCode: "MTH",
        levelNum: 100,
        semesterName: "SECOND",
      },
    ];

    const coursesByCode: Record<
      string,
      { id: string; code: string; departmentId: string }
    > = {};

    for (const c of courseSpecs) {
      const course = await prisma.course.upsert({
        where: { code: c.code },
        update: {
          title: c.title,
          creditUnits: c.creditUnits,
          departmentId: depts[c.deptCode].id,
          programId: programs[c.deptCode].id,
          levelId: levelsByNum[c.levelNum].id,
          semesterName: c.semesterName,
          isActive: true,
        },
        create: {
          code: c.code,
          title: c.title,
          creditUnits: c.creditUnits,
          departmentId: depts[c.deptCode].id,
          programId: programs[c.deptCode].id,
          levelId: levelsByNum[c.levelNum].id,
          semesterName: c.semesterName,
          isActive: true,
        },
      });
      coursesByCode[c.code] = {
        id: course.id,
        code: course.code,
        departmentId: course.departmentId,
      };

      if (c.lecturerKey && c.semesterName === "FIRST") {
        const lec = lecturers[c.lecturerKey];
        await prisma.courseAssignment.upsert({
          where: {
            courseId_lecturerId_semesterId: {
              courseId: course.id,
              lecturerId: lec.id,
              semesterId: currFirstSem.id,
            },
          },
          update: {},
          create: {
            courseId: course.id,
            lecturerId: lec.id,
            semesterId: currFirstSem.id,
          },
        });
      }
    }

    // Helper to upsert a registration and optionally create/upsert its Result + AuditLogs
    async function seedRegistrationAndResult(params: {
      studentIndex: number;
      courseCode: string;
      semesterId: string;
      result?: {
        caScore: number;
        examScore: number;
        status: ResultStatus;
        enteredByUserId: string;
        reviewedByUserId?: string;
        reviewedByRole?: Role;
        feedback?: string;
      };
    }) {
      const student = studentsByIndex[params.studentIndex];
      const course = coursesByCode[params.courseCode];

      const reg = await prisma.courseRegistration.upsert({
        where: {
          studentId_courseId_semesterId: {
            studentId: student.id,
            courseId: course.id,
            semesterId: params.semesterId,
          },
        },
        update: {},
        create: {
          studentId: student.id,
          courseId: course.id,
          semesterId: params.semesterId,
        },
      });

      if (!params.result) {
        return;
      }

      const {
        caScore,
        examScore,
        status,
        enteredByUserId,
        reviewedByUserId,
        reviewedByRole = "DEPARTMENT_ADMIN",
        feedback,
      } = params.result;

      const totalScore = Number((caScore + examScore).toFixed(2));
      const { grade, gradePoint } = lookupGrade(totalScore, scaleRows);

      const submittedAt =
        status === "SUBMITTED" ||
        status === "APPROVED" ||
        status === "RETURNED"
          ? new Date("2026-11-01T10:00:00.000Z")
          : null;

      const reviewedAt =
        status === "APPROVED" || status === "RETURNED"
          ? new Date("2026-11-05T14:00:00.000Z")
          : null;

      const existingResult = await prisma.result.findUnique({
        where: { registrationId: reg.id },
      });

      if (existingResult) {
        // Update result fields idempotently without duplicating AuditLogs
        await prisma.result.update({
          where: { id: existingResult.id },
          data: {
            studentId: reg.studentId,
            courseId: reg.courseId,
            semesterId: reg.semesterId,
            caScore,
            examScore,
            totalScore,
            grade,
            gradePoint,
            status,
            feedback: feedback ?? null,
            enteredById: enteredByUserId,
            submittedAt,
            reviewedById: reviewedByUserId ?? null,
            reviewedAt,
          },
        });
        return;
      }

      await prisma.$transaction(async (tx) => {
        const createdResult = await tx.result.create({
          data: {
            registrationId: reg.id,
            studentId: reg.studentId,
            courseId: reg.courseId,
            semesterId: reg.semesterId,
            caScore,
            examScore,
            totalScore,
            grade,
            gradePoint,
            status,
            feedback: feedback ?? null,
            enteredById: enteredByUserId,
            submittedAt,
            reviewedById: reviewedByUserId ?? null,
            reviewedAt,
          },
        });

        const transitions: {
          actorId: string;
          actorRole: Role;
          action: AuditAction;
          reason?: string;
        }[] = [
          {
            actorId: enteredByUserId,
            actorRole: "LECTURER",
            action: "RESULT_DRAFT_SAVED",
          },
        ];

        if (
          status === "SUBMITTED" ||
          status === "APPROVED" ||
          status === "RETURNED"
        ) {
          transitions.push({
            actorId: enteredByUserId,
            actorRole: "LECTURER",
            action: "RESULT_SUBMITTED",
          });
        }

        if (status === "APPROVED" && reviewedByUserId) {
          transitions.push({
            actorId: reviewedByUserId,
            actorRole: reviewedByRole,
            action: "RESULT_APPROVED",
          });
        }

        if (status === "RETURNED" && reviewedByUserId) {
          transitions.push({
            actorId: reviewedByUserId,
            actorRole: reviewedByRole,
            action: "RESULT_RETURNED",
            reason: feedback,
          });
        }

        for (const t of transitions) {
          await tx.auditLog.create({
            data: {
              actorId: t.actorId,
              actorRole: t.actorRole,
              departmentId: course.departmentId,
              action: t.action,
              entityType: "Result",
              entityId: createdResult.id,
              afterSummary: {
                courseCode: params.courseCode,
                caScore,
                examScore,
                totalScore,
                grade,
                status,
              },
              reason: t.reason ?? null,
            },
          });
        }
      });
    }

    // =====================================================================
    // SCENARIO S1: CSC 301 (CSC 300L) - 9 registered students (student01..09), all SUBMITTED
    // Note: student10 is CSC 300L with ZERO current registrations (Scenario S7)
    // =====================================================================
    for (let idx = 1; idx <= 9; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 301",
        semesterId: currFirstSem.id,
        result: {
          caScore: 20 + (idx % 9),
          examScore: 42 + ((idx * 3) % 24),
          status: "SUBMITTED",
          enteredByUserId: lecturers.lecturer1.userId,
        },
      });
    }

    // =====================================================================
    // SCENARIO S2: CSC 303 (CSC 300L) - 9 registered students (student01..09), NO result rows
    // =====================================================================
    for (let idx = 1; idx <= 9; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 303",
        semesterId: currFirstSem.id,
      });
    }

    // =====================================================================
    // SCENARIO S3: CSC 305 (CSC 300L) - 8 registered students (student01..08), all DRAFT results
    // =====================================================================
    for (let idx = 1; idx <= 8; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 305",
        semesterId: currFirstSem.id,
        result: {
          caScore: 18 + (idx % 10),
          examScore: 38 + ((idx * 4) % 25),
          status: "DRAFT",
          enteredByUserId: lecturers.lecturer2.userId,
        },
      });
    }

    // =====================================================================
    // SCENARIO S4: CSC 307 (CSC 300L) - 8 registered students (student01..08), RETURNED with feedback
    // =====================================================================
    for (let idx = 1; idx <= 8; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 307",
        semesterId: currFirstSem.id,
        result: {
          caScore: 19 + (idx % 8),
          examScore: 40 + ((idx * 2) % 22),
          status: "RETURNED",
          enteredByUserId: lecturers.lecturer2.userId,
          reviewedByUserId: cscAdminUser.id,
          feedback:
            "Please verify CA score computation for network lab assessment and resubmit.",
        },
      });
    }

    // =====================================================================
    // SCENARIO S5: CSC 309 (CSC 300L) - 9 registered students (student01..09), APPROVED current-semester results
    // =====================================================================
    for (let idx = 1; idx <= 9; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 309",
        semesterId: currFirstSem.id,
        result: {
          caScore: 22 + (idx % 7),
          examScore: 46 + ((idx * 3) % 20),
          status: "APPROVED",
          enteredByUserId: lecturers.lecturer3.userId,
          reviewedByUserId: cscAdminUser.id,
        },
      });
    }

    // Current registrations for CSC 200L students (student11..14)
    for (let idx = 11; idx <= 14; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 201",
        semesterId: currFirstSem.id,
      });
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 203",
        semesterId: currFirstSem.id,
      });
    }

    // =====================================================================
    // SCENARIO S6: MTH 201 (MTH 200L) - 4 registered students (student19..22), all SUBMITTED
    // =====================================================================
    for (let idx = 19; idx <= 22; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "MTH 201",
        semesterId: currFirstSem.id,
        result: {
          caScore: 21 + (idx % 6),
          examScore: 44 + ((idx * 2) % 20),
          status: "SUBMITTED",
          enteredByUserId: lecturers.lecturer4.userId,
        },
      });
    }

    // =====================================================================
    // SCENARIO S8: Previous Session (2025/2026) APPROVED results (both semesters)
    // for 200L and 300L students so CGPA and history are meaningful
    // =====================================================================
    // 300L CSC students (student01..student10) took CSC 201 & CSC 203 in 2025/2026 FIRST, and CSC 202 in 2025/2026 SECOND
    for (let idx = 1; idx <= 10; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 201",
        semesterId: prevFirstSem.id,
        result: {
          caScore: 21 + (idx % 7),
          examScore: 45 + ((idx * 2) % 20),
          status: "APPROVED",
          enteredByUserId: lecturers.lecturer1.userId,
          reviewedByUserId: cscAdminUser.id,
        },
      });
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 203",
        semesterId: prevFirstSem.id,
        result: {
          caScore: 19 + (idx % 8),
          examScore: 41 + ((idx * 3) % 22),
          status: "APPROVED",
          enteredByUserId: lecturers.lecturer3.userId,
          reviewedByUserId: cscAdminUser.id,
        },
      });
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 202",
        semesterId: prevSecondSem.id,
        result: {
          caScore: 23 + (idx % 6),
          examScore: 47 + ((idx * 2) % 18),
          status: "APPROVED",
          enteredByUserId: lecturers.lecturer1.userId,
          reviewedByUserId: cscAdminUser.id,
        },
      });
    }

    // 200L CSC students (student11..student14) took CSC 101 & CSC 103 in 2025/2026 FIRST, and CSC 102 in 2025/2026 SECOND
    for (let idx = 11; idx <= 14; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 101",
        semesterId: prevFirstSem.id,
        result: {
          caScore: 20 + (idx % 7),
          examScore: 43 + ((idx * 2) % 20),
          status: "APPROVED",
          enteredByUserId: lecturers.lecturer2.userId,
          reviewedByUserId: cscAdminUser.id,
        },
      });
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 103",
        semesterId: prevFirstSem.id,
        result: {
          caScore: 18 + (idx % 8),
          examScore: 40 + ((idx * 3) % 22),
          status: "APPROVED",
          enteredByUserId: lecturers.lecturer3.userId,
          reviewedByUserId: cscAdminUser.id,
        },
      });
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "CSC 102",
        semesterId: prevSecondSem.id,
        result: {
          caScore: 22 + (idx % 6),
          examScore: 46 + ((idx * 2) % 18),
          status: "APPROVED",
          enteredByUserId: lecturers.lecturer2.userId,
          reviewedByUserId: cscAdminUser.id,
        },
      });
    }

    // 200L MTH students (student19..student22) took MTH 101 in 2025/2026 FIRST and MTH 102 in 2025/2026 SECOND
    for (let idx = 19; idx <= 22; idx++) {
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "MTH 101",
        semesterId: prevFirstSem.id,
        result: {
          caScore: 21 + (idx % 6),
          examScore: 44 + ((idx * 2) % 20),
          status: "APPROVED",
          enteredByUserId: lecturers.lecturer4.userId,
          reviewedByUserId: mthAdminUser.id,
        },
      });
      await seedRegistrationAndResult({
        studentIndex: idx,
        courseCode: "MTH 102",
        semesterId: prevSecondSem.id,
        result: {
          caScore: 20 + (idx % 7),
          examScore: 42 + ((idx * 3) % 21),
          status: "APPROVED",
          enteredByUserId: lecturers.lecturer4.userId,
          reviewedByUserId: mthAdminUser.id,
        },
      });
    }

    // Print row counts and credentials table
    const counts = {
      users: await prisma.user.count(),
      faculties: await prisma.faculty.count(),
      departments: await prisma.department.count(),
      departmentAdmins: await prisma.departmentAdmin.count(),
      programs: await prisma.program.count(),
      academicLevels: await prisma.academicLevel.count(),
      academicSessions: await prisma.academicSession.count(),
      semesters: await prisma.semester.count(),
      students: await prisma.student.count(),
      lecturers: await prisma.lecturer.count(),
      courses: await prisma.course.count(),
      courseAssignments: await prisma.courseAssignment.count(),
      courseRegistrations: await prisma.courseRegistration.count(),
      results: await prisma.result.count(),
      gradeScale: await prisma.gradeScale.count(),
      auditLogs: await prisma.auditLog.count(),
    };

    console.log("\n=== Seeded Table Row Counts ===");
    console.table(counts);

    console.log("\n=== Demo Credentials (Password: Uemp@Demo2026) ===");
    console.table([
      {
        Role: "SUPER_ADMIN",
        Email: "superadmin@uemp.demo",
        Scope: "University-wide",
      },
      {
        Role: "DEPARTMENT_ADMIN",
        Email: "deptadmin.csc@uemp.demo",
        Scope: "Computer Science (CSC)",
      },
      {
        Role: "DEPARTMENT_ADMIN",
        Email: "deptadmin.mth@uemp.demo",
        Scope: "Mathematics (MTH)",
      },
      {
        Role: "LECTURER",
        Email: "lecturer1@uemp.demo",
        Scope: "CSC (CSC 301, CSC 303, CSC 201, CSC 401)",
      },
      {
        Role: "LECTURER",
        Email: "lecturer2@uemp.demo",
        Scope: "CSC (CSC 305, CSC 307, CSC 101)",
      },
      {
        Role: "LECTURER",
        Email: "lecturer4@uemp.demo",
        Scope: "MTH (MTH 201, MTH 203)",
      },
      {
        Role: "STUDENT",
        Email: "student01@uemp.demo",
        Scope: "CSC 300L (Registered + Results)",
      },
      {
        Role: "STUDENT",
        Email: "student10@uemp.demo",
        Scope: "CSC 300L (Zero Current Registrations - S7)",
      },
    ]);
  } finally {
    if (!prismaOverride) {
      await prisma.$disconnect();
    }
  }
}

const isDirectCliRun = Boolean(
  process.argv.some(
    (arg) =>
      arg.replace(/\\/g, "/").endsWith("prisma/seed.ts") ||
      arg.replace(/\\/g, "/").endsWith("/seed.ts") ||
      arg === "prisma/seed.ts"
  )
);

if (isDirectCliRun) {
  seed().catch((err) => {
    console.error("[seed] Error:", err);
    process.exit(1);
  });
}


import { AppError } from "@/lib/errors";
import type {
  CreateSessionInput,
  UpdateSemesterInput,
  UpdateSessionInput,
} from "@/lib/validators/structure";
import type { SessionContext } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/services/audit.service";

export async function listSessions() {
  return prisma.academicSession.findMany({
    orderBy: { startDate: "desc" },
    include: {
      semesters: {
        orderBy: { name: "asc" },
      },
    },
  });
}

export async function createSession(
  session: SessionContext,
  input: CreateSessionInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only Super Admin can create academic sessions."
    );
  }

  return prisma.$transaction(async (tx) => {
    if (input.isCurrent) {
      await tx.semester.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.academicSession.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const created = await tx.academicSession.create({
      data: {
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        isCurrent: Boolean(input.isCurrent),
        semesters: {
          create: [
            {
              name: "FIRST",
              isCurrent: Boolean(input.isCurrent),
              registrationOpen: true,
            },
            {
              name: "SECOND",
              isCurrent: false,
              registrationOpen: false,
            },
          ],
        },
      },
      include: {
        semesters: { orderBy: { name: "asc" } },
      },
    });

    await writeAudit(tx, {
      actorId: session.userId,
      actorRole: session.role,
      action: "ENTITY_CREATED",
      entityType: "AcademicSession",
      entityId: created.id,
      afterSummary: {
        name: created.name,
        startDate: created.startDate.toISOString(),
        endDate: created.endDate.toISOString(),
        isCurrent: created.isCurrent,
      },
    });

    if (input.isCurrent) {
      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        action: "SESSION_CURRENT_CHANGED",
        entityType: "AcademicSession",
        entityId: created.id,
        afterSummary: {
          sessionName: created.name,
          isCurrent: true,
        },
      });
    }

    return created;
  });
}

export async function updateSession(
  session: SessionContext,
  id: string,
  input: UpdateSessionInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only Super Admin can update academic sessions."
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.academicSession.findUnique({
      where: { id },
      include: { semesters: { orderBy: { name: "asc" } } },
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Academic session not found.");
    }

    const nextStartDate = input.startDate ?? existing.startDate;
    const nextEndDate = input.endDate ?? existing.endDate;
    if (nextStartDate >= nextEndDate) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "startDate must be earlier than endDate."
      );
    }

    if (input.isCurrent === true) {
      // Unset isCurrent on all other sessions and all other sessions' semesters first
      await tx.semester.updateMany({
        where: { sessionId: { not: id }, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.academicSession.updateMany({
        where: { id: { not: id }, isCurrent: true },
        data: { isCurrent: false },
      });

      const hasCurrentSemInThisSession = existing.semesters.some(
        (s) => s.isCurrent
      );
      if (!hasCurrentSemInThisSession) {
        const firstSem = existing.semesters.find((s) => s.name === "FIRST");
        if (firstSem) {
          await tx.semester.update({
            where: { id: firstSem.id },
            data: { isCurrent: true },
          });
        }
      }
    }

    const updated = await tx.academicSession.update({
      where: { id },
      data: {
        startDate: nextStartDate,
        endDate: nextEndDate,
        ...(input.isCurrent === true ? { isCurrent: true } : {}),
      },
      include: {
        semesters: { orderBy: { name: "asc" } },
      },
    });

    if (input.isCurrent === true && !existing.isCurrent) {
      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        action: "SESSION_CURRENT_CHANGED",
        entityType: "AcademicSession",
        entityId: updated.id,
        beforeSummary: {
          name: existing.name,
          isCurrent: existing.isCurrent,
        },
        afterSummary: {
          name: updated.name,
          isCurrent: updated.isCurrent,
        },
      });
    }

    if (input.startDate !== undefined || input.endDate !== undefined) {
      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        action: "ENTITY_UPDATED",
        entityType: "AcademicSession",
        entityId: updated.id,
        beforeSummary: {
          startDate: existing.startDate.toISOString(),
          endDate: existing.endDate.toISOString(),
        },
        afterSummary: {
          startDate: updated.startDate.toISOString(),
          endDate: updated.endDate.toISOString(),
        },
      });
    }

    return updated;
  });
}

export async function updateSemester(
  session: SessionContext,
  id: string,
  input: UpdateSemesterInput
) {
  if (session.role !== "SUPER_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only Super Admin can update semesters."
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.semester.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Semester not found.");
    }

    if (input.isCurrent === true && !existing.session.isCurrent) {
      throw new AppError(
        400,
        "SESSION_NOT_CURRENT",
        "Cannot set a semester as current when its academic session is not current."
      );
    }

    if (input.isCurrent === true) {
      await tx.semester.updateMany({
        where: { id: { not: id }, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const updated = await tx.semester.update({
      where: { id },
      data: {
        ...(input.registrationOpen !== undefined
          ? { registrationOpen: input.registrationOpen }
          : {}),
        ...(input.isCurrent === true ? { isCurrent: true } : {}),
      },
      include: { session: true },
    });

    if (input.isCurrent === true && !existing.isCurrent) {
      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        action: "SESSION_CURRENT_CHANGED",
        entityType: "Semester",
        entityId: updated.id,
        beforeSummary: {
          sessionName: existing.session.name,
          semesterName: existing.name,
          isCurrent: existing.isCurrent,
        },
        afterSummary: {
          sessionName: updated.session.name,
          semesterName: updated.name,
          isCurrent: updated.isCurrent,
        },
      });
    }

    if (
      input.registrationOpen !== undefined &&
      input.registrationOpen !== existing.registrationOpen
    ) {
      await writeAudit(tx, {
        actorId: session.userId,
        actorRole: session.role,
        action: "ENTITY_UPDATED",
        entityType: "Semester",
        entityId: updated.id,
        beforeSummary: {
          sessionName: existing.session.name,
          semesterName: existing.name,
          registrationOpen: existing.registrationOpen,
        },
        afterSummary: {
          sessionName: updated.session.name,
          semesterName: updated.name,
          registrationOpen: updated.registrationOpen,
        },
      });
    }

    return updated;
  });
}


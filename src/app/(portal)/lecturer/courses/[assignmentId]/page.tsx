import { notFound } from "next/navigation";
import { LecturerScoreSheet } from "@/components/lecturer/LecturerScoreSheet";
import { requireRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db/prisma";

export default async function LecturerAssignmentScoreSheetPage(props: {
  params: Promise<{ assignmentId: string }>;
}) {
  const session = await requireRole(["LECTURER"]);
  const { assignmentId } = await props.params;

  const assignment = await prisma.courseAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      lecturerId: true,
      courseId: true,
      semesterId: true,
    },
  });

  if (!assignment || assignment.lecturerId !== session.lecturerId) {
    notFound();
  }

  return (
    <LecturerScoreSheet
      courseId={assignment.courseId}
      semesterId={assignment.semesterId}
      assignmentId={assignment.id}
    />
  );
}

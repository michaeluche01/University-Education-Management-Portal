-- Partial unique index ensuring at most one AcademicSession can have isCurrent = true
CREATE UNIQUE INDEX "AcademicSession_single_isCurrent_idx"
ON "AcademicSession" ("isCurrent")
WHERE "isCurrent" = true;

-- Partial unique index ensuring at most one Semester can have isCurrent = true
CREATE UNIQUE INDEX "Semester_single_isCurrent_idx"
ON "Semester" ("isCurrent")
WHERE "isCurrent" = true;


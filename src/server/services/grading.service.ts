export interface GradeScaleBand {
  grade: string;
  minScore: number;
  maxScore: number;
  gradePoint: number;
}

export interface GradeLookupResult {
  grade: string;
  gradePoint: number;
}

/**
 * Pure function implementing Decision D4:
 * Finds the highest GradeScale band where minScore <= totalScore.
 * Scores may have decimals (e.g. 39.5, 44.9, 69.5).
 * Anything below the lowest band's minScore returns F with 0 points.
 */
export function lookupGrade(
  totalScore: number,
  scaleRows: readonly GradeScaleBand[]
): GradeLookupResult {
  if (!Number.isFinite(totalScore) || totalScore < 0 || scaleRows.length === 0) {
    return { grade: "F", gradePoint: 0 };
  }

  let bestMatch: GradeScaleBand | null = null;

  for (const band of scaleRows) {
    if (band.minScore <= totalScore) {
      if (bestMatch === null || band.minScore > bestMatch.minScore) {
        bestMatch = band;
      }
    }
  }

  if (!bestMatch) {
    return { grade: "F", gradePoint: 0 };
  }

  return {
    grade: bestMatch.grade,
    gradePoint: bestMatch.gradePoint,
  };
}


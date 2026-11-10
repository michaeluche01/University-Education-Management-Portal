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

export interface ComputedResultFields {
  totalScore: number;
  grade: string;
  gradePoint: number;
}

export interface GpaRowInput {
  gradePoint: number;
  creditUnits: number;
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

/**
 * Validates that a numeric score is finite, within [min, max],
 * and has at most 2 decimal places (using integer-hundredths arithmetic).
 */
export function validateScore(
  val: number,
  min: number,
  max: number,
  label: string
): void {
  if (typeof val !== "number" || !Number.isFinite(val)) {
    throw new Error(`${label} must be a valid finite number.`);
  }
  if (val < min || val > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  // Check that value has at most 2 decimals
  const hundredths = Math.round(val * 100);
  if (Math.abs(val - hundredths / 100) > 1e-6) {
    throw new Error(`${label} cannot have more than 2 decimal places.`);
  }
}

/**
 * Validates CA (0..30) and Exam (0..70), performs integer hundredths addition,
 * and looks up grade & gradePoint from the scale.
 */
export function computeResultFields(
  caScore: number,
  examScore: number,
  scaleRows: readonly GradeScaleBand[]
): ComputedResultFields {
  validateScore(caScore, 0, 30, "CA score");
  validateScore(examScore, 0, 70, "Exam score");

  // Integer hundredths arithmetic to prevent floating-point inaccuracies
  const caInt = Math.round(caScore * 100);
  const examInt = Math.round(examScore * 100);
  const totalScore = (caInt + examInt) / 100;

  const { grade, gradePoint } = lookupGrade(totalScore, scaleRows);

  return {
    totalScore,
    grade,
    gradePoint,
  };
}

/**
 * Round a positive number half-up to 2 decimal places.
 */
export function roundHalfUp2Decimals(val: number): number {
  if (!Number.isFinite(val)) return 0;
  // + 1e-9 absorbs IEEE 754 float imprecisions when exactly at x.xx5
  return Math.floor(val * 100 + 0.5 + 1e-9) / 100;
}

/**
 * Computes credit-unit weighted GPA:
 * sum(gradePoint * creditUnits) / sum(creditUnits)
 * Rounded half-up to 2 decimal places.
 * Returns null if total credit units is 0.
 */
export function calculateWeightedGpa(
  rows: readonly GpaRowInput[]
): number | null {
  if (!rows || rows.length === 0) {
    return null;
  }

  let totalPoints = 0;
  let totalUnits = 0;

  for (const row of rows) {
    if (!Number.isFinite(row.gradePoint) || !Number.isFinite(row.creditUnits)) {
      continue;
    }
    if (row.creditUnits > 0) {
      totalPoints += row.gradePoint * row.creditUnits;
      totalUnits += row.creditUnits;
    }
  }

  if (totalUnits === 0) {
    return null;
  }

  const raw = totalPoints / totalUnits;
  return roundHalfUp2Decimals(raw);
}

export const semesterGpa = calculateWeightedGpa;
export const cgpa = calculateWeightedGpa;

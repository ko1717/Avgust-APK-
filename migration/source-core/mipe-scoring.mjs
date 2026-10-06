/**
 * AVGUST CARE 360 — supplemental chapter-weighted MIPE analysis
 *
 * This DOM-free comparison is complementary; lib/model.ts remains the official
 * 1.5.35 indicator and is not changed by these chapter weights.
 */

export const CHAPTER_WEIGHTS = Object.freeze({
  1: 0.05,
  2: 0.30,
  3: 0.05,
  4: 0.30,
  5: 0.30
});

export const CHAPTER_INFO = Object.freeze({
  1: { id: 1, weight: 0.05, maxPoints: 5, criteriaCount: 4 },
  2: { id: 2, weight: 0.30, maxPoints: 30, criteriaCount: 8 },
  3: { id: 3, weight: 0.05, maxPoints: 5, criteriaCount: 4 },
  4: { id: 4, weight: 0.30, maxPoints: 30, criteriaCount: 10 },
  5: { id: 5, weight: 0.30, maxPoints: 30, criteriaCount: 11 }
});

export const CRITERIA_BY_CHAPTER = Object.freeze({
  1: Object.freeze(["1.1", "1.2", "1.3", "1.4"]),
  2: Object.freeze(["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8"]),
  3: Object.freeze(["3.1", "3.2", "3.3", "3.4"]),
  4: Object.freeze(["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10"]),
  5: Object.freeze(["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11"])
});

export const CRITERIA_COUNT = 37;

const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;

export function normalizeChapterSelection(chapters) {
  return Array.isArray(chapters) && chapters.length
    ? chapters.map(Number).filter((id) => CHAPTER_WEIGHTS[id] != null)
    : [1, 2, 3, 4, 5];
}

export function readAnswer(answer) {
  if (typeof answer === "string") return answer;
  if (answer && typeof answer === "object") return answer.value;
  return null;
}

/**
 * Official scoring rule:
 * - SI = compliant
 * - NO = finding/non-compliant
 * - NA/unanswered = not applicable / not evaluated
 * - A chapter contributes only when it is selected and has >=1 applicable SI/NO criterion.
 * - Its chapter weight is normalized over evaluated chapters; unevaluated chapters add 0
 *   points and are never treated as 100%.
 */
export function calculateVisitScore(visit) {
  if (!visit || !visit.answers) {
    return {
      pointsEarned: 0,
      criteriaCompliance: null,
      weightedScore: null,
      auditedWeight: 0,
      chapterScores: {},
      chapterPoints: {},
      evaluatedChapters: [],
      findingsCount: 0,
      applicableCount: 0,
      positiveCount: 0
    };
  }

  const selected = new Set(normalizeChapterSelection(visit.chapters));
  const chapterScores = {};
  const chapterPoints = {};
  const evaluatedChapters = [];

  let totalPointsEarned = 0;
  let totalAuditedWeight = 0;
  let totalFindings = 0;
  let totalApplicable = 0;
  let totalPositive = 0;

  for (const chapterId of [1, 2, 3, 4, 5]) {
    const included = selected.has(chapterId);
    let applicable = 0;
    let positive = 0;
    let findings = 0;

    if (included) {
      for (const criterionId of CRITERIA_BY_CHAPTER[chapterId]) {
        const value = readAnswer(visit.answers[criterionId]);
        if (value === "SI" || value === "NO") {
          applicable += 1;
          totalApplicable += 1;
          if (value === "SI") {
            positive += 1;
            totalPositive += 1;
          } else {
            findings += 1;
            totalFindings += 1;
          }
        }
      }
    }

    if (included && applicable > 0) {
      const compliance = (positive / applicable) * 100;
      const points = (compliance / 100) * (CHAPTER_WEIGHTS[chapterId] * 100);
      chapterScores[chapterId] = round1(compliance);
      chapterPoints[chapterId] = round1(points);
      evaluatedChapters.push(chapterId);
      totalPointsEarned += points;
      totalAuditedWeight += CHAPTER_WEIGHTS[chapterId];
    } else {
      chapterScores[chapterId] = null;
      chapterPoints[chapterId] = 0;
    }
  }

  return {
    pointsEarned: round1(totalPointsEarned),
    criteriaCompliance: totalApplicable > 0 ? round1((totalPositive / totalApplicable) * 100) : null,
    weightedScore: totalAuditedWeight > 0
      ? round1(totalPointsEarned / totalAuditedWeight)
      : null,
    auditedWeight: round2(totalAuditedWeight),
    chapterScores,
    chapterPoints,
    evaluatedChapters,
    findingsCount: totalFindings,
    applicableCount: totalApplicable,
    positiveCount: totalPositive
  };
}

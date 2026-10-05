import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAPTER_WEIGHTS,
  CHAPTER_INFO,
  CRITERIA_BY_CHAPTER,
  CRITERIA_COUNT,
  calculateVisitScore,
  calculatePortfolioScore
} from "../../migration/source-core/mipe-scoring.mjs";

test("official MIPE structure remains 100 points and 37 criteria", () => {
  assert.equal(Object.values(CHAPTER_WEIGHTS).reduce((a, b) => a + b, 0), 1);
  assert.equal(Object.values(CHAPTER_INFO).reduce((a, c) => a + c.criteriaCount, 0), 37);
  assert.equal(Object.values(CRITERIA_BY_CHAPTER).flat().length, CRITERIA_COUNT);
});

test("empty visit is never treated as perfect", () => {
  const result = calculateVisitScore({ answers: {} });
  assert.equal(result.pointsEarned, 0);
  assert.equal(result.criteriaCompliance, null);
  assert.equal(result.weightedScore, null);
  assert.deepEqual(result.evaluatedChapters, []);
});

test("all SI across all chapters scores 100", () => {
  const answers = Object.fromEntries(
    Object.values(CRITERIA_BY_CHAPTER).flat().map((id) => [id, "SI"])
  );
  const result = calculateVisitScore({ answers });
  assert.equal(result.pointsEarned, 100);
  assert.equal(result.criteriaCompliance, 100);
  assert.equal(result.weightedScore, 100);
  assert.deepEqual(result.evaluatedChapters, [1, 2, 3, 4, 5]);
});

test("all NO across all chapters scores zero with 37 findings", () => {
  const answers = Object.fromEntries(
    Object.values(CRITERIA_BY_CHAPTER).flat().map((id) => [id, "NO"])
  );
  const result = calculateVisitScore({ answers });
  assert.equal(result.pointsEarned, 0);
  assert.equal(result.criteriaCompliance, 0);
  assert.equal(result.weightedScore, 0);
  assert.equal(result.findingsCount, 37);
});

test("partial audit normalizes weighted score only across evaluated chapters", () => {
  const answers = Object.fromEntries(CRITERIA_BY_CHAPTER[2].map((id) => [id, "SI"]));
  const result = calculateVisitScore({ answers, chapters: [2] });
  assert.equal(result.pointsEarned, 30);
  assert.equal(result.auditedWeight, 0.3);
  assert.equal(result.weightedScore, 100);
  assert.equal(result.chapterScores[1], null);
  assert.equal(result.chapterScores[2], 100);
});

test("NA and unanswered criteria do not inflate compliance", () => {
  const answers = {
    "1.1": "SI",
    "1.2": "NA",
    "1.3": null,
    "1.4": "NO"
  };
  const result = calculateVisitScore({ answers, chapters: [1] });
  assert.equal(result.applicableCount, 2);
  assert.equal(result.positiveCount, 1);
  assert.equal(result.criteriaCompliance, 50);
  assert.equal(result.pointsEarned, 2.5);
  assert.equal(result.weightedScore, 50);
});

test("portfolio aggregation preserves reviewed=false exclusion", () => {
  const yes = { answers: Object.fromEntries(CRITERIA_BY_CHAPTER[1].map((id) => [id, "SI"])) };
  const no = { reviewed: false, answers: Object.fromEntries(CRITERIA_BY_CHAPTER[1].map((id) => [id, "NO"])) };
  const result = calculatePortfolioScore([yes, no]);
  assert.equal(result.visits, 1);
  assert.equal(result.pointsEarned, 5);
  assert.equal(result.criteriaCompliance, 100);
  assert.equal(result.weightedScore, 100);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateVisitScore,
  CRITERIA_COUNT,
  CHAPTER_WEIGHTS
} from "../../migration/source-core/mipe-scoring.mjs";

const allCriteria = Array.from({ length: CRITERIA_COUNT }, (_, index) => {
  const chapter = index < 4 ? 1 : index < 12 ? 2 : index < 16 ? 3 : index < 26 ? 4 : 5;
  const position = index - [0, 4, 12, 16, 26].findLast((start) => index >= start) + 1;
  return `${chapter}.${position}`;
});

test("parity fixture: all 37 criteria SI produces 100 points", () => {
  const answers = Object.fromEntries(allCriteria.map((id) => [id, "SI"]));
  const score = calculateVisitScore({ answers });

  assert.equal(score.pointsEarned, 100);
  assert.equal(score.criteriaCompliance, 100);
  assert.equal(score.weightedScore, 100);
  assert.equal(score.auditedWeight, 1);
  assert.deepEqual(score.evaluatedChapters, [1, 2, 3, 4, 5]);
  assert.equal(score.applicableCount, 37);
  assert.equal(score.positiveCount, 37);
  assert.equal(score.findingsCount, 0);
});

test("parity fixture: all 37 criteria NO preserves official chapter weights", () => {
  const answers = Object.fromEntries(allCriteria.map((id) => [id, "NO"]));
  const score = calculateVisitScore({ answers });

  assert.equal(score.pointsEarned, 0);
  assert.equal(score.criteriaCompliance, 0);
  assert.equal(score.weightedScore, 0);
  assert.equal(score.auditedWeight, 1);
  assert.equal(score.applicableCount, 37);
  assert.equal(score.positiveCount, 0);
  assert.equal(score.findingsCount, 37);
});

test("parity fixture: partial audit normalizes only evaluated chapter weights", () => {
  const answers = {
    "2.1": "SI",
    "2.2": "NO",
    "5.1": "SI",
    "5.2": "SI",
    "5.3": "NO"
  };
  const score = calculateVisitScore({
    chapters: [2, 5],
    answers
  });

  assert.equal(score.evaluatedChapters.length, 2);
  assert.equal(score.applicableCount, 5);
  assert.equal(score.positiveCount, 3);
  assert.equal(score.findingsCount, 2);
  assert.equal(score.chapterScores[2], 50);
  assert.equal(score.chapterScores[5], 66.7);
  assert.equal(score.pointsEarned, 35);
  assert.equal(score.auditedWeight, 0.6);
  assert.equal(score.weightedScore, 58.3);
});

test("chapter weights remain the official 5/30/5/30/30 model", () => {
  assert.deepEqual(CHAPTER_WEIGHTS, {
    1: 0.05,
    2: 0.30,
    3: 0.05,
    4: 0.30,
    5: 0.30
  });
});
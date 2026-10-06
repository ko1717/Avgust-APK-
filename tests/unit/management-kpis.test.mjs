import test from "node:test";
import assert from "node:assert/strict";
import { calculateManagementKpis } from "../../migration/source-core/management-kpis.mjs";

const score = (visit) => ({
  pointsEarned: visit.points,
  evaluatedChapters: visit.full ? [1, 2, 3, 4, 5] : [2],
  applicableCount: visit.applicable,
  positiveCount: visit.positive,
  findingsCount: visit.findings
});

const catalog = {
  "2.1": { severity: "critical" },
  "2.2": { severity: "high" }
};

test("management KPIs are complementary and deterministic", () => {
  const result = calculateManagementKpis({
    visits: [
      {
        date: "2026-10-01",
        points: 80,
        full: true,
        applicable: 10,
        positive: 8,
        findings: 2,
        answers: {
          "2.1": { value: "NO", repeat: true, status: "open" },
          "2.2": { value: "NO", status: "resolved" }
        }
      },
      {
        date: "2026-09-10",
        points: 100,
        full: false,
        applicable: 5,
        positive: 5,
        findings: 0,
        answers: { "2.1": "SI" }
      }
    ],
    criteriaCatalog: catalog,
    calculateVisitScore: score,
    now: new Date("2026-10-05T12:00:00")
  });

  assert.equal(result.official.averagePointsPerScoredAudit, 90);
  assert.equal(result.operational.auditCoveragePct, 60);
  assert.equal(result.operational.auditCompletenessPct, 50);
  assert.equal(result.operational.auditVelocity30d, 2);
  assert.equal(result.operational.dataQualityPct, 100);
  assert.equal(result.risk.criticalRiskExposurePct, 50);
  assert.equal(result.risk.repeatFindingRatePct, 50);
  assert.equal(result.improvement.findingClosureRatePct, 50);
  assert.equal(result.quality.criteriaCompliancePct, 86.7);
});

test("missing finding lifecycle metadata stays null, not zero", () => {
  const result = calculateManagementKpis({
    visits: [{ date: "2026-10-01", answers: { "2.1": "NO" } }],
    criteriaCatalog: catalog,
    calculateVisitScore: () => ({
      pointsEarned: 70,
      evaluatedChapters: [2],
      applicableCount: 1,
      positiveCount: 0,
      findingsCount: 1
    }),
    now: new Date("2026-10-05")
  });
  assert.equal(result.improvement.findingClosureRatePct, null);
  assert.equal(result.risk.repeatFindingRatePct, null);
});

test("official points are passed through, never changed by management KPI formulas", () => {
  const result = calculateManagementKpis({
    visits: [{ date: "2026-10-01", points: 73.4, answers: {} }],
    calculateVisitScore: (v) => ({
      pointsEarned: v.points,
      evaluatedChapters: [1, 2, 3, 4, 5],
      applicableCount: 37,
      positiveCount: 27,
      findingsCount: 10
    }),
    now: new Date("2026-10-05")
  });
  assert.equal(result.official.averagePointsPerScoredAudit, 73.4);
});

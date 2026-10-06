import test from "node:test";
import assert from "node:assert/strict";
import { buildIntelligenceViewModel } from "../../migration/source-core/intelligence-view-model.mjs";

const management = {
  quality: {
    criteriaCompliancePct: 88,
    totalFindings: 4,
    reviewedAudits: 2,
    scoredAudits: 2
  },
  operational: {
    auditCoveragePct: 100,
    auditCompletenessPct: 100,
    auditVelocity30d: 2,
    dataQualityPct: 100
  },
  risk: {
    criticalRiskExposurePct: 10,
    repeatFindingRatePct: 25
  },
  improvement: {
    findingClosureRatePct: 50
  }
};

test("hierarchy preserves official points", () => {
  const viewModel = buildIntelligenceViewModel({
    official: { points: 82 },
    management,
    scope: {
      farm: "A",
      lot: "L1",
      crop: "Rosa",
      coveragePct: 100
    }
  });

  assert.equal(viewModel.performance.officialMipePoints, 82);
  assert.equal(viewModel.execution.closureRatePct, 50);
});

test("coverage mismatch blocks trend", () => {
  const viewModel = buildIntelligenceViewModel({
    official: { points: 82 },
    management,
    scope: {
      farm: "A",
      lot: "L1",
      crop: "Rosa",
      coveragePct: 60
    },
    previous: {
      farm: "A",
      lot: "L1",
      crop: "Rosa",
      coveragePct: 100,
      points: 90
    }
  });

  assert.equal(viewModel.trend.comparable, false);
  assert.equal(viewModel.trend.deltaPoints, null);
});

test("same scope permits trend", () => {
  const viewModel = buildIntelligenceViewModel({
    official: { points: 82 },
    management,
    scope: {
      farm: "A",
      lot: "L1",
      crop: "Rosa",
      coveragePct: 100
    },
    previous: {
      farm: "A",
      lot: "L1",
      crop: "Rosa",
      coveragePct: 100,
      points: 90
    }
  });

  assert.equal(viewModel.trend.comparable, true);
  assert.equal(viewModel.trend.deltaPoints, -8);
});

test("benchmark excludes different coverage", () => {
  const viewModel = buildIntelligenceViewModel({
    management,
    scope: {
      crop: "Rosa",
      coveragePct: 100
    },
    benchmark: [
      { farm: "B", crop: "Rosa", coveragePct: 100, officialPoints: 80 },
      { farm: "C", crop: "Rosa", coveragePct: 60, officialPoints: 95 }
    ]
  });

  assert.equal(viewModel.benchmark.comparable.length, 1);
  assert.equal(viewModel.benchmark.comparable[0].farm, "B");
});

test("missing management evidence remains null", () => {
  const viewModel = buildIntelligenceViewModel();

  assert.equal(viewModel.performance.officialMipePoints, null);
  assert.equal(viewModel.execution.closureRatePct, null);
  assert.equal(viewModel.assurance.dataQualityPct, null);
  assert.equal(viewModel.risk.criticalExposurePct, null);
});
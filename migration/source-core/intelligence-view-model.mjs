/**
 * AVGUST CARE 360 — Executive Intelligence ViewModel
 *
 * Transitional DOM-free orchestration layer.
 * Official MIPE scoring remains authoritative; management KPIs are complementary.
 */

const round1 = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 10) / 10
    : null;

const sameText = (a, b) =>
  String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

function isSameTrendScope(current, previous) {
  if (!previous) return false;

  return (
    sameText(current.farm, previous.farm) &&
    (current.lot || "") === (previous.lot || "") &&
    (current.crop || "") === (previous.crop || "") &&
    current.coveragePct === previous.coveragePct
  );
}

export function buildIntelligenceViewModel({
  official = {},
  management = {},
  riskCriteria = [],
  findings = 0,
  scope = {},
  previous = null,
  benchmark = []
} = {}) {
  const currentScope = {
    farm: scope.farm || "",
    lot: scope.lot || "",
    crop: scope.crop || "",
    coveragePct:
      typeof scope.coveragePct === "number" ? scope.coveragePct : null
  };

  const trendComparable = isSameTrendScope(currentScope, previous);

  const comparableBenchmarks = benchmark.filter(
    (item) =>
      item &&
      item.officialPoints != null &&
      item.coveragePct === currentScope.coveragePct &&
      (item.crop || "") === currentScope.crop
  );

  return {
    version: "1.0.0",
    scope: currentScope,

    performance: {
      officialMipePoints: official.points ?? null,
      criteriaCompliancePct:
        management.quality?.criteriaCompliancePct ?? null,
      coveragePct:
        management.operational?.auditCoveragePct ??
        currentScope.coveragePct
    },

    risk: {
      criticalExposurePct:
        management.risk?.criticalRiskExposurePct ?? null,
      repeatFindingRatePct:
        management.risk?.repeatFindingRatePct ?? null,
      totalFindings:
        management.quality?.totalFindings ?? findings ?? null,
      topCriteria: Array.isArray(riskCriteria)
        ? riskCriteria.slice(0, 5)
        : []
    },

    execution: {
      closureRatePct:
        management.improvement?.findingClosureRatePct ?? null,
      velocity30d:
        management.operational?.auditVelocity30d ?? null
    },

    assurance: {
      completenessPct:
        management.operational?.auditCompletenessPct ?? null,
      dataQualityPct:
        management.operational?.dataQualityPct ?? null,
      reviewedAudits:
        management.quality?.reviewedAudits ?? null,
      scoredAudits:
        management.quality?.scoredAudits ?? null
    },

    trend: {
      comparable: trendComparable,
      deltaPoints:
        trendComparable &&
        typeof official.points === "number" &&
        typeof previous?.points === "number"
          ? round1(official.points - previous.points)
          : null,
      status: trendComparable ? "comparable" : "scope-mismatch"
    },

    benchmark: {
      comparable: comparableBenchmarks,
      comparableCount: comparableBenchmarks.length,
      policy:
        "Mismo cultivo y cobertura auditada; registros incomparables no se rankean como equivalentes."
    }
  };
}

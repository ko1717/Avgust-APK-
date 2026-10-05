/**
 * AVGUST CARE 360 — Management KPI core
 *
 * Managerial/operational KPIs complement the official MIPE 0–100 score.
 * They never modify, penalize, or reinterpret official MIPE points.
 */
const round1 = (n) => Math.round(n * 10) / 10;

function answerValue(answer) {
  return typeof answer === "string" ? answer : answer?.value ?? null;
}

export function calculateManagementKpis({
  visits = [],
  criteriaCatalog = {},
  calculateVisitScore,
  now = new Date()
} = {}) {
  const reviewed = visits.filter((v) => v && v.reviewed !== false);
  const validDated = reviewed.filter((v) => v.date && !Number.isNaN(new Date(v.date).getTime()));

  let evaluatedChapters = 0;
  const possibleChapters = reviewed.length * 5;
  let fullyEvaluated = 0;
  let totalApplicable = 0;
  let totalPositive = 0;
  let criticalApplicable = 0;
  let criticalFindings = 0;
  let totalFindings = 0;
  let repeatFindings = 0;
  let repeatFindingsKnown = false;
  let resolvedFindings = 0;
  let lifecycleFindings = 0;
  let officialPoints = 0;
  let scoredVisits = 0;

  for (const visit of reviewed) {
    const score = typeof calculateVisitScore === "function" ? calculateVisitScore(visit) : null;
    if (score) {
      evaluatedChapters += Array.isArray(score.evaluatedChapters) ? score.evaluatedChapters.length : 0;
      totalApplicable += score.applicableCount || 0;
      totalPositive += score.positiveCount || 0;
      totalFindings += score.findingsCount || 0;
      if (score.evaluatedChapters?.length === 5) fullyEvaluated++;
      if (typeof score.pointsEarned === "number") {
        officialPoints += score.pointsEarned;
        scoredVisits++;
      }
    }

    for (const [criterionId, answer] of Object.entries(visit.answers || {})) {
      if (answerValue(answer) !== "NO") continue;
      const criterion = criteriaCatalog[criterionId] || {};
      if (criterion.severity === "critical") {
        criticalApplicable++;
        criticalFindings++;
      }

      const repeat = answer?.repeat ?? answer?.isRepeat ?? answer?.recurrent;
      if (typeof repeat === "boolean") {
        repeatFindingsKnown = true;
        if (repeat) repeatFindings++;
      }

      const status = answer?.status ?? answer?.findingStatus ?? answer?.closureStatus;
      if (typeof status === "string") {
        lifecycleFindings++;
        if (["resolved", "closed", "cerrado", "resuelto"].includes(status.toLowerCase())) resolvedFindings++;
      }
    }
  }

  return {
    version: "1.0.0",
    official: {
      averagePointsPerScoredAudit: scoredVisits > 0 ? round1(officialPoints / scoredVisits) : null
    },
    operational: {
      auditCoveragePct: possibleChapters > 0 ? round1((evaluatedChapters / possibleChapters) * 100) : null,
      auditCompletenessPct: reviewed.length > 0 ? round1((fullyEvaluated / reviewed.length) * 100) : null,
      auditVelocity30d: validDated.filter((v) => {
        const d = new Date(v.date);
        const diff = (now - d) / 86400000;
        return diff >= 0 && diff <= 30;
      }).length,
      dataQualityPct: reviewed.length > 0 ? round1((validDated.length / reviewed.length) * 100) : null
    },
    risk: {
      criticalRiskExposurePct: criticalApplicable > 0 ? round1((criticalFindings / criticalApplicable) * 100) : null,
      repeatFindingRatePct: repeatFindingsKnown && totalFindings > 0 ? round1((repeatFindings / totalFindings) * 100) : null
    },
    improvement: {
      findingClosureRatePct: lifecycleFindings > 0 ? round1((resolvedFindings / lifecycleFindings) * 100) : null
    },
    quality: {
      criteriaCompliancePct: totalApplicable > 0 ? round1((totalPositive / totalApplicable) * 100) : null,
      reviewedAudits: reviewed.length,
      scoredAudits: scoredVisits,
      totalFindings
    }
  };
}

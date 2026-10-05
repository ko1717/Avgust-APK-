# AVGUST CARE 360 — KPI Management Dictionary

## Purpose

The official MIPE score remains the **methodological score (0–100 points)**. Management KPIs are a separate decision layer. They explain **coverage, risk, quality, improvement and execution** without changing the official score.

## KPI set

| KPI | Purpose | Formula / rule | Missing data |
|---|---|---|---|
| Official MIPE points | Methodological performance | Existing official engine | Preserve existing semantics |
| Criteria compliance | Overall SI / applicable SI+NO | positive / applicable | null |
| Audit coverage | How much of the MIPE scope was actually evaluated | evaluated chapters / (reviewed audits × 5) | null |
| Audit completeness | Share of audits covering all 5 chapters | full audits / reviewed audits | null |
| Audit velocity | Operational cadence | reviewed valid audits in rolling 30 days | 0 is valid |
| Data quality | Audit records with valid dates | valid dated / reviewed | null |
| Critical risk exposure | Exposure of critical criteria | critical NO / critical SI+NO | null |
| Repeat finding rate | Recurrence of problems | repeat findings / total findings, only when repeat metadata exists | null |
| Finding closure rate | Improvement execution | closed/resolved tracked findings / tracked findings | null |
| Total findings | Absolute non-conformities | official SI/NO aggregation | 0 is valid |

## Design rules

1. **Never replace the official 0–100 MIPE score with a managerial KPI.**
2. A missing lifecycle field is **unknown**, not zero.
3. Coverage and completeness are explicit because a high score from a narrow audit must not look equivalent to a fully evaluated audit.
4. Risk KPIs are diagnostic; they do not silently subtract points from the official methodology.
5. The dashboard should present a small executive hierarchy:
   - **Performance:** official MIPE points.
   - **Execution:** closure rate + audit velocity.
   - **Risk:** critical exposure + repeat findings.
   - **Assurance:** coverage + completeness + data quality.
6. Future trend/benchmark features must compare equivalent scope (same farm/lot/context and comparable audit coverage) before showing a delta.

## Recommended executive presentation

**Primary:** Official MIPE points + coverage.

**Secondary:** Critical risk exposure, finding closure rate, repeat finding rate.

**Operational:** Audit completeness, audit velocity, data quality.

This structure is deliberately separate from the existing official weighting of 5/30/5/30/30.

export type ScoringAnswer = string | { value?: string } | null | undefined;

export type ScoringVisit = {
  answers?: Record<string, ScoringAnswer>;
  chapters?: number[];
};

export type VisitScore = {
  pointsEarned: number;
  criteriaCompliance: number | null;
  weightedScore: number | null;
  auditedWeight: number;
  chapterScores: Record<number, number | null>;
  chapterPoints: Record<number, number>;
  evaluatedChapters: number[];
  findingsCount: number;
  applicableCount: number;
  positiveCount: number;
};

export function calculateVisitScore(visit?: ScoringVisit | null): VisitScore;

export type ScoreBand = "low" | "mid" | "high";

export function classifyScore(score: number): ScoreBand {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError(`classifyScore: score must be 0–100, got ${score}`);
  }
  if (score >= 70) return "high";
  if (score >= 50) return "mid";
  return "low";
}

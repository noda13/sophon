// Upper bounds (inclusive) of the low / moderate / elevated / high levels.
// Keep in sync with scoreToLevel in backend/src/schemas/riskConstants.ts.
export const RISK_LEVEL_BOUNDS = [20, 40, 60, 80] as const;

const [LOW_MAX, MODERATE_MAX, ELEVATED_MAX, HIGH_MAX] = RISK_LEVEL_BOUNDS;

// Action signals use the same cut points as the risk levels, so a score never
// reads "やや高い" next to a "様子見" signal.
export const SIGNAL_BOUNDS = {
  hold: LOW_MAX,
  watch: MODERATE_MAX,
  prepare: ELEVATED_MAX,
  hedge: HIGH_MAX,
} as const;

// Trend chart reference lines mark where "prepare" and "hedge" begin.
export const CHART_WARNING_SCORE = SIGNAL_BOUNDS.watch;
export const CHART_ALERT_SCORE = SIGNAL_BOUNDS.prepare;

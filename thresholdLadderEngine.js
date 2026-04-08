// thresholdLadderEngine.js
// Engine for analyzing threshold ladder markets on Polymarket
// Exports analyzeThresholdLadder(markets, options) => [{ marketId, signals: [...] }]

/**
 * Analyze threshold ladder markets for distortion or inefficiency signals.
 * @param {Object} market - The market object from Polymarket API
 * @param {Object} [options] - Optional config (e.g., thresholds)
 * @returns {Object} { marketId, signals: [...] }
 */
export function analyzeThresholdLadder(market, options = {}) {
  // Example: Detects if any threshold step is mispriced relative to neighbors
  const signals = [];
  if (!market || !market.outcomes || !Array.isArray(market.outcomes)) return { marketId: market?.id, signals };

  const { outcomes } = market;
  const defaultThreshold = 0.08; // Example: 8% deviation triggers signal
  const threshold = options.threshold || defaultThreshold;

  for (let i = 1; i < outcomes.length - 1; i++) {
    const prev = outcomes[i - 1]?.price;
    const curr = outcomes[i]?.price;
    const next = outcomes[i + 1]?.price;
    if (prev == null || curr == null || next == null) continue;
    const avgNeighbors = (prev + next) / 2;
    const deviation = Math.abs(curr - avgNeighbors);
    if (deviation > threshold) {
      signals.push({
        outcomeIndex: i,
        outcomeName: outcomes[i].name,
        price: curr,
        avgNeighbors,
        deviation,
        message: `Threshold ladder distortion: ${outcomes[i].name} price deviates by ${(deviation * 100).toFixed(2)}% from neighbors.`
      });
    }
  }

  return { marketId: market.id, signals };
}

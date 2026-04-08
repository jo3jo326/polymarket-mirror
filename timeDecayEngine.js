// timeDecayEngine.js
// Engine for detecting time decay mispricing in prediction markets
// Exports analyzeTimeDecay(markets, options) => [{ marketId, signals: [...] }]

/**
 * Analyze markets for time decay mispricing (e.g., "Will X happen by June?", "by December?").
 * Looks for non-monotonic or inconsistent probability curves over time.
 * @param {Object} market - The market object from Polymarket API
 * @param {Object} [options] - Optional config (e.g., thresholds)
 * @returns {Object} { marketId, signals: [...] }
 */
export function analyzeTimeDecay(market, options = {}) {
  const signals = [];
  if (!market || !market.outcomes || !Array.isArray(market.outcomes)) return { marketId: market?.id, signals };

  // Extract outcome dates and probabilities
  const timeOutcomes = market.outcomes
    .map((o, i) => {
      // Try to extract a date from the outcome name (e.g., "by June 2026")
      const dateMatch = o.name.match(/(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{4}|\d{4})/i);
      return {
        index: i,
        name: o.name,
        price: o.price,
        date: dateMatch ? new Date(dateMatch[0]) : null
      };
    })
    .filter(o => o.date && typeof o.price === 'number');

  if (timeOutcomes.length < 2) return { marketId: market.id, signals };

  // Sort by date ascending
  timeOutcomes.sort((a, b) => a.date - b.date);

  // Check for non-monotonicity (probabilities should not increase as time increases)
  for (let i = 1; i < timeOutcomes.length; i++) {
    if (timeOutcomes[i].price > timeOutcomes[i - 1].price + 0.03) { // 3% tolerance
      signals.push({
        from: timeOutcomes[i - 1],
        to: timeOutcomes[i],
        message: `Time decay violation: Probability increases from ${timeOutcomes[i - 1].name} (${(timeOutcomes[i - 1].price * 100).toFixed(1)}%) to ${timeOutcomes[i].name} (${(timeOutcomes[i].price * 100).toFixed(1)}%)`
      });
    }
  }

  // Optional: Check for unrealistic time decay (e.g., curve is too flat or too steep)
  // This can be expanded with hazard rate logic if desired.

  return { marketId: market.id, signals };
}

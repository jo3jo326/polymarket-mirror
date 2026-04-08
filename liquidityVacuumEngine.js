// liquidityVacuumEngine.js
// Detects liquidity vacuum distortions in Polymarket markets
// Exports: analyzeLiquidityVacuum(markets)

/**
 * Analyzes markets for liquidity vacuum distortions.
 * Looks for buckets/outcomes with sharp price moves and low volume.
 * Returns an array of detected signals with details.
 * @param {Array} markets - Array of market objects (with price, volume, orderbook info)
 * @returns {Array} Array of liquidity vacuum distortion signals
 */
export function analyzeLiquidityVacuum(markets) {
  const signals = [];
  for (const market of markets) {
    if (!market.outcomes || market.outcomes.length < 2) continue;
    // Look for buckets with sharp price changes and low volume
    for (let i = 0; i < market.outcomes.length; i++) {
      const o = market.outcomes[i];
      // Heuristic: price spike/drop > 15% AND volume < $500
      if (o.priceChangeAbs && o.priceChangeAbs > 0.15 && o.volume < 500) {
        signals.push({
          marketId: market.id,
          marketTitle: market.title,
          outcome: o.title,
          price: o.price,
          priceChangeAbs: o.priceChangeAbs,
          volume: o.volume,
          reason: 'Liquidity vacuum: sharp price move with low volume',
        });
      }
      // Heuristic: orderbook gap > 10% between best bid/ask
      if (o.bestAsk && o.bestBid && (o.bestAsk - o.bestBid) > 0.10) {
        signals.push({
          marketId: market.id,
          marketTitle: market.title,
          outcome: o.title,
          price: o.price,
          bestBid: o.bestBid,
          bestAsk: o.bestAsk,
          reason: 'Liquidity vacuum: large orderbook gap',
        });
      }
    }
  }
  return signals;
}
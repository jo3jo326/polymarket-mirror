import { normalizeUniswapTickerToMarket } from '../../normalizers/normalizeUniswap';
import fetch from 'node-fetch';

export async function fetchUniswapEvents(): Promise<any[]> {
  const url = 'https://api.coingecko.com/api/v3/exchanges/uniswap_v3/tickers';
  const res = await fetch(url);
  const data = await res.json();
  if (!data.tickers) return [];
  // Each ticker is its own event for clustering compatibility
  return data.tickers.slice(0, 50).map((ticker: any, idx: number) => {
    const market = normalizeUniswapTickerToMarket(ticker, idx);
    // Guarantee a valid ISO string resolutionDate for Stage 1
    const syntheticResolution = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    return {
      id: `uniswap_event_${idx}`,
      title: `${ticker.base}/${ticker.target} on Uniswap`,
      markets: [
        {
          ...market,
          outcomePrices: JSON.stringify([1, ticker.last]),
          resolutionDate: market.resolutionDate || syntheticResolution
        }
      ],
      tags: ['uniswap', 'dex', 'crypto', ticker.base.toLowerCase(), ticker.target.toLowerCase()]
    };
  });
}

import fetch from 'node-fetch';
import { Market } from '../algorithms/anticipationAlgorithm';

interface Ticker {
  base: string;
  target: string;
  last: number;
  converted_volume: { usd: number };
  market: { name: string };
}

interface CoingeckoResponse {
  tickers?: Ticker[];
  [key: string]: any;
}

// Normalize Coingecko Uniswap ticker to internal Market format
function normalizeUniswapTickerToMarket(ticker: Ticker, idx: number): Market {
  return {
    id: `uniswap_${ticker.base}_${ticker.target}_${idx}`,
    question: `${ticker.base}/${ticker.target} on Uniswap` ,
    title: `${ticker.base}/${ticker.target}`,
    outcomes: [
      { name: ticker.base, price: 1 },
      { name: ticker.target, price: ticker.last }
    ],
    volume: ticker.converted_volume.usd,
    tags: [ticker.market.name]
  };
}

async function main() {
  const url = 'https://api.coingecko.com/api/v3/exchanges/uniswap_v3/tickers';
  const res = await fetch(url);
  const data: CoingeckoResponse = await res.json();
  if (!data.tickers) {
    console.error('No tickers found:', data);
    return;
  }
  // Normalize all tickers
  const markets: Market[] = data.tickers.slice(0, 20).map(normalizeUniswapTickerToMarket);
  console.log('Normalized Uniswap Markets:', markets);
  // Here you can pass markets to your algorithm, e.g.:
  // const results = analyzeAnticipationOpportunities([{ id: 'uniswap', markets }], [], {});
  // console.log('Algorithm Results:', results);
}

main().catch(console.error);

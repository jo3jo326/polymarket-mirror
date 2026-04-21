import fetch from 'node-fetch';
import { normalizeUniswapTickerToMarket } from '../../normalizers/normalizeUniswap';

export async function fetchMarkets() {
  const url = 'https://api.coingecko.com/api/v3/exchanges/uniswap_v3/tickers';
  const res = await fetch(url);
  const data = await res.json();
  if (!data.tickers) return [];
  // Normalize to internal Market format
  return data.tickers.slice(0, 50).map(normalizeUniswapTickerToMarket);
}

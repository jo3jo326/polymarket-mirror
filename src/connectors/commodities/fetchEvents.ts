import fetch from 'node-fetch';
import { normalizeAlphaVantageCommodityToMarket } from '../../normalizers/normalizeAlphaVantageCommodity';


const BASE_URL = 'https://www.alphavantage.co/query';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAlphaVantage(endpoint: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(endpoint);
    const data = await res.json();
    // Check for rate limit message
    if (data && typeof data === 'object' && data.Information && data.Information.includes('rate limit')) {
      console.warn('AlphaVantage rate limit hit, retrying in 1500ms...');
      await sleep(1500);
      continue;
    }
    return data;
  }
  return null;
}

export async function fetchCommoditiesEvents(): Promise<any[]> {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  const now = new Date();
  const syntheticResolution = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

  // Gold and Silver endpoints are not supported by Alpha Vantage free tier anymore.
  // Only fetch WTI and Brent Oil for now.

  // WTI Oil
  const wtiUrl = `${BASE_URL}?function=WTI&apikey=${apiKey}`;
  const wtiData = await fetchAlphaVantage(wtiUrl);
  console.log('AlphaVantage WTI Response:', JSON.stringify(wtiData, null, 2));
  await sleep(1100);

  // Brent Oil
  const brentUrl = `${BASE_URL}?function=BRENT&apikey=${apiKey}`;
  const brentData = await fetchAlphaVantage(brentUrl);
  console.log('AlphaVantage Brent Response:', JSON.stringify(brentData, null, 2));

  // Normalize and wrap as events
  const events = [
    normalizeAlphaVantageCommodityToMarket('WTI Oil', wtiData, syntheticResolution),
    normalizeAlphaVantageCommodityToMarket('Brent Oil', brentData, syntheticResolution),
  ].filter(Boolean);

  return events;
}

// Fetch top Uniswap pairs from Coingecko
// Run: npm install node-fetch@2 if not already installed

const fetch = require('node-fetch');

async function fetchUniswapPairs() {
  const url = 'https://api.coingecko.com/api/v3/exchanges/uniswap_v3/tickers';
  const res = await fetch(url);
  const data = await res.json();
  if (!data.tickers) {
    console.error('No tickers found:', data);
    return;
  }
  console.log('Top Uniswap V3 pairs from Coingecko:');
  data.tickers.slice(0, 10).forEach((ticker, i) => {
    console.log(`\n#${i+1}`);
    console.log(`Pair: ${ticker.base}/${ticker.target}`);
    console.log(`Last Price: ${ticker.last}`);
    console.log(`Volume (USD): ${ticker.converted_volume.usd}`);
    console.log(`Market: ${ticker.market.name}`);
  });
}

fetchUniswapPairs().catch(console.error);

// Normalizer for Alpha Vantage commodity data
export function normalizeAlphaVantageCommodityToMarket(name: string, data: any, syntheticResolution: string) {
  let price = null;
  let date = new Date().toISOString();

  if (name === 'Gold' || name === 'Silver') {
    // Alpha Vantage FX endpoint
    const info = data['Realtime Currency Exchange Rate'];
    if (info && info['5. Exchange Rate']) {
      price = parseFloat(info['5. Exchange Rate']);
      date = info['6. Last Refreshed'] || date;
    }
  } else if (name === 'WTI Oil' || name === 'Brent Oil') {
    // Alpha Vantage commodity endpoint
    if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
      // Use the most recent value
      price = parseFloat(data.data[0].value);
      date = data.data[0].date || date;
    }
  }

  if (!price) return null;

  return {
    id: `alphavantage_${name.replace(/\s+/g, '').toLowerCase()}`,
    title: `${name} Price` ,
    question: `${name} price in USD` ,
    markets: [
      {
        id: `alphavantage_${name.replace(/\s+/g, '').toLowerCase()}_usd` ,
        question: `${name} price in USD` ,
        title: `${name}USD` ,
        outcomes: [
          { price: price },
          { price: 1 - price } // For binary compatibility, though not meaningful for spot
        ],
        volume: 0,
        tags: ['commodity', name.toLowerCase()],
        resolutionDate: syntheticResolution,
        endDate: syntheticResolution,
        endDateIso: syntheticResolution,
        endTime: syntheticResolution,
        outcomePrices: JSON.stringify([price, 1 - price]),
        lastUpdated: date,
        active: true,
        closed: false
      }
    ],
    tags: ['alphavantage', 'commodity', name.toLowerCase()]
  };
}

import dotenv from 'dotenv';
dotenv.config();

import { alertRouter, AlertType } from '../shared/alertRouter';

// Example: Simulate a trade signal
type TradeSignal = {
  market: string;
  exchange: string;
  details: string;
  confidence: number;
};

async function onTradeSignal(signal: TradeSignal) {
  await alertRouter({
    type: 'TRADE',
    market: signal.market,
    exchange: signal.exchange,
    details: signal.details,
    confidence: signal.confidence,
    detectedAt: new Date().toISOString(),
  });
}

// Example usage:
onTradeSignal({
  market: 'BTC > $100k before June',
  exchange: 'Polymarket',
  details: 'Current Price: 42%\nSignal Type: DDS Distortion\nSuggested Entry: Buy YES < 45%\nTake Profit: 65%\nStop Loss: 30%',
  confidence: 8.7,
});

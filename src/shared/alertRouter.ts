import { sendEmailAlert } from '../shared/sendEmailAlert';

export type AlertType = 'TRADE' | 'WATCHLIST' | 'SYSTEM';

interface Alert {
  type: AlertType;
  market: string;
  exchange: string;
  details: string;
  confidence?: number;
  detectedAt?: string;
}

export async function alertRouter(alert: Alert) {
  let subject = '';
  let body = '';

  switch (alert.type) {
    case 'TRADE':
      subject = `[TRADE] ${alert.exchange} | ${alert.market}`;
      body = `Exchange: ${alert.exchange}\nMarket: ${alert.market}\n\n${alert.details}\n\nConfidence: ${alert.confidence}\nDetected: ${alert.detectedAt}`;
      break;
    case 'WATCHLIST':
      subject = `[WATCHLIST] ${alert.exchange} | ${alert.market}`;
      body = `Exchange: ${alert.exchange}\nMarket: ${alert.market}\n\n${alert.details}\nDetected: ${alert.detectedAt}`;
      break;
    case 'SYSTEM':
      subject = `[SYSTEM] ${alert.market}`;
      body = `${alert.details}\nDetected: ${alert.detectedAt}`;
      break;
  }

  await sendEmailAlert(subject, body);
}

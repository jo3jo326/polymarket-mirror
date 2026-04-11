// Kalshi API signing utility for Node.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function loadPrivateKeyFromFile(filePath: string): string {
  const absolutePath = path.resolve(filePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

export function signPssText(privateKeyPem: string, text: string): string {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(text);
  sign.end();
  const signature = sign.sign({
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });
  return signature.toString('base64');
}

export function getKalshiAuthHeaders({
  keyId,
  privateKeyPem,
  method,
  path
}: {
  keyId: string;
  privateKeyPem: string;
  method: string;
  path: string;
}) {
  const timestamp = Date.now().toString();
  const pathWithoutQuery = path.split('?')[0];
  const msgString = timestamp + method.toUpperCase() + pathWithoutQuery;
  const signature = signPssText(privateKeyPem, msgString);
  return {
    'KALSHI-ACCESS-KEY': keyId,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'KALSHI-ACCESS-TIMESTAMP': timestamp
  };
}

import CryptoJS from 'crypto-js';

/**
 * LINE Webhook 署名検証
 */
export function validateSignature(
  body: string,
  channelSecret: string,
  signature: string
): boolean {
  const hash = CryptoJS.HmacSHA256(body, channelSecret).toString(
    CryptoJS.enc.Base64
  );
  return hash === signature;
}

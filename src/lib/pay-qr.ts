export const MAX_QR_LENGTH = 512;

export function isPaymentQr(text: string) {
  const code = text.trim();
  if (!code || code.length > MAX_QR_LENGTH) return false;
  if (code.startsWith("000201")) return true;
  return !/^[a-z][a-z0-9+.-]*:/i.test(code) && !/^www\./i.test(code) && !/^[^\s/]+\.[a-z]{2,}(\/|$)/i.test(code);
}

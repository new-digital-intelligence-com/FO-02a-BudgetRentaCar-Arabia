/**
 * A phone number in international form (+9665…), or null when it cannot be one. A local Saudi mobile
 * (05xxxxxxxx) becomes +9665xxxxxxxx; any other number must be typed with its country code.
 */
export function normalisePhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (/^05\d{8}$/.test(digits)) digits = `+966${digits.slice(1)}`;
  if (/^9665\d{8}$/.test(digits)) digits = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

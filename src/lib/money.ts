export function euroTextToCents(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) {
    return null;
  }

  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

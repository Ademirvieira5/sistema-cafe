const sign = (value: string, allowNegative: boolean) =>
  allowNegative && value.trimStart().startsWith("-") ? "-" : "";

export function formatMoneyTyping(value: string, allowNegative = false) {
  const prefix = sign(value, allowNegative);
  const clean = value.replace(/[^\d,]/g, "");
  const comma = clean.indexOf(",");
  const integerRaw = (comma >= 0 ? clean.slice(0, comma) : clean).replace(/^0+(?=\d)/, "") || "0";
  const integer = integerRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (comma < 0) return `${prefix}${integer}`;
  const decimals = clean.slice(comma + 1).replace(/,/g, "").slice(0, 2);
  return `${prefix}${integer},${decimals}`;
}

export function finalizeMoneyInput(value: string, allowNegative = false) {
  if (!value.trim()) return "";
  const formatted = formatMoneyTyping(value, allowNegative);
  if (!formatted.includes(",")) return `${formatted},00`;
  const [integer, decimals = ""] = formatted.split(",");
  return `${integer},${decimals.padEnd(2, "0")}`;
}

export function moneyFromDecimal(value: string | number | null | undefined) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const raw = String(value).trim();
  if (raw.includes(",")) return finalizeMoneyInput(raw, raw.startsWith("-"));
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [integer = "0", decimals = ""] = unsigned.split(".");
  return finalizeMoneyInput(`${negative ? "-" : ""}${integer},${decimals.slice(0, 2)}`, negative);
}

export function moneyFromCents(value: number) {
  const negative = value < 0;
  const absolute = Math.abs(Math.round(value));
  const integer = Math.floor(absolute / 100);
  const decimals = String(absolute % 100).padStart(2, "0");
  return finalizeMoneyInput(`${negative ? "-" : ""}${integer},${decimals}`, negative);
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpfCnpj(value?: string | null) {
  const digits = onlyDigits(value ?? "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value ?? "—";
}

export function formatMoney(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export function parseMoney(value: unknown) {
  if (typeof value === "number") return value.toFixed(2);
  const raw = String(value ?? "0").trim();
  if (!raw) return "0.00";
  const groupedInteger = /^-?\d{1,3}(\.\d{3})+$/.test(raw);
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : groupedInteger ? raw.replace(/\./g, "") : raw;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized).toFixed(2);
}


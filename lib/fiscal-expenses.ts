export type XmlExpenseInstallment = { number?: string; dueDate?: string; amount?: number | string };

export function isCoffeeItems(items: { description?: string; ncm?: string }[]) {
  return items.some((item) => {
    const description = String(item.description || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const ncm = String(item.ncm || "").replace(/\D/g, "");
    return ncm.startsWith("0901") || /\bCAFE\b/.test(description);
  });
}

export function normalizeExpenseInstallments(installments: XmlExpenseInstallment[], totalCents: number, issueDate: string) {
  const normalized = installments.map((part, index) => ({
    number: String(part.number || index + 1),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(part.dueDate || "")) ? String(part.dueDate) : issueDate,
    amountCents: Math.round(Number(part.amount || 0) * 100),
  })).filter((part) => part.amountCents > 0);
  if (!normalized.length) return [{ number: "1", dueDate: issueDate, amountCents: totalCents }];
  const difference = totalCents - normalized.reduce((sum, part) => sum + part.amountCents, 0);
  normalized[normalized.length - 1].amountCents += difference;
  return normalized[normalized.length - 1].amountCents > 0
    ? normalized
    : [{ number: "1", dueDate: issueDate, amountCents: totalCents }];
}

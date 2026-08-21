export type FiscalAggregateInstallmentRow = { id: string; total_amount_cents: number; estimated_kilograms_milli: number | null; installments_json: string; issue_date: string };

function toCents(value: unknown) {
  const raw = String(value ?? "0").trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function aggregateFiscalInstallments(rows: FiscalAggregateInstallmentRow[], totalCents: number) {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    let parts: { dueDate?: string; amount?: string | number }[] = [];
    try { parts = JSON.parse(row.installments_json || "[]"); } catch { parts = []; }
    if (!parts.length) parts = [{ dueDate: row.issue_date, amount: (Number(row.total_amount_cents) / 100).toFixed(2) }];
    for (const part of parts) {
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(part.dueDate || "")) ? String(part.dueDate) : row.issue_date;
      byDate.set(dueDate, (byDate.get(dueDate) || 0) + toCents(part.amount));
    }
  }
  const result = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dueDate, amountCents]) => ({ dueDate, amountCents }));
  const difference = totalCents - result.reduce((sum, part) => sum + part.amountCents, 0);
  if (!result.length) result.push({ dueDate: rows[0]?.issue_date || new Date().toISOString().slice(0, 10), amountCents: totalCents });
  else result[result.length - 1].amountCents += difference;
  return result;
}

export function subtractRetentionFromInstallments(parts: { dueDate: string; amountCents: number }[], retentionCents: number) {
  const result = parts.map((part) => ({ ...part }));
  let remaining = Math.max(0, retentionCents);
  for (let index = result.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const reduction = Math.min(result[index].amountCents, remaining);
    result[index].amountCents -= reduction;
    remaining -= reduction;
  }
  return result.filter((part) => part.amountCents > 0);
}

export function calculateFiscalAdjustment(input: { fiscalTotalCents: number; commercialTotalCents: number; returnTotalCents: number; fiscalKilogramsMilli: number; receivedKilogramsMilli: number; returnKilogramsMilli: number }) {
  const originalDifferenceCents = Math.max(0, input.fiscalTotalCents - input.commercialTotalCents);
  const originalKilogramsMilli = Math.max(0, input.fiscalKilogramsMilli - input.receivedKilogramsMilli);
  const openDifferenceCents = Math.max(0, originalDifferenceCents - input.returnTotalCents);
  const openKilogramsMilli = Math.max(0, originalKilogramsMilli - input.returnKilogramsMilli);
  const status = originalDifferenceCents <= 0 && originalKilogramsMilli <= 0 ? "NO_DIFFERENCE" : openDifferenceCents <= 0 && openKilogramsMilli <= 0 ? "SETTLED" : input.returnTotalCents > 0 || input.returnKilogramsMilli > 0 ? "PARTIAL" : "OPEN";
  return { originalDifferenceCents, originalKilogramsMilli, openDifferenceCents, openKilogramsMilli, status } as const;
}

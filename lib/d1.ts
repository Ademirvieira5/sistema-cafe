export function d1() {
  const db = (globalThis as typeof globalThis & { __SISTEMA_CAFE_DB?: D1Database }).__SISTEMA_CAFE_DB;
  if (!db) throw new Error("Banco do Sistema Café indisponível.");
  return db;
}

export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export function decimal(value: unknown) {
  const raw = String(value ?? "0").trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error("Valor inválido.");
  return parsed;
}

export const cents = (value: unknown) => Math.round(decimal(value) * 100);
export const money = (value: number) => (value / 100).toFixed(2);
export const kilogramsMilli = (value: unknown) => Math.round(decimal(value) * 1000);
export const kilograms = (value: number) => (value / 1000).toFixed(3);

export function bool(value: unknown) { return value ? 1 : 0; }
export function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }

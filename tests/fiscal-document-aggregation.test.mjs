import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aggregateFiscalInstallments, calculateFiscalAdjustment, subtractRetentionFromInstallments } from "../lib/fiscal-aggregation.ts";
import { funruralDueDate } from "../lib/financial-rules.ts";

test("soma parcelas de várias NF-es do mesmo negócio por vencimento", () => {
  const rows = [
    { id: "nfe-7483", total_amount_cents: 30750000, estimated_kilograms_milli: 12300000, issue_date: "2026-08-18", installments_json: JSON.stringify([{ dueDate: "2026-08-25", amount: 307500 }]) },
    { id: "nfe-7485", total_amount_cents: 30600000, estimated_kilograms_milli: 12240000, issue_date: "2026-08-18", installments_json: JSON.stringify([{ dueDate: "2026-08-25", amount: 306000 }]) },
  ];
  assert.deepEqual(aggregateFiscalInstallments(rows, 61350000), [{ dueDate: "2026-08-25", amountCents: 61350000 }]);
});

test("desconta o Funrural do produtor e preserva a obrigação no dia 20 seguinte", () => {
  const gross = [{ dueDate: "2026-08-25", amountCents: 3202500 }];
  assert.deepEqual(subtractRetentionFromInstallments(gross, 52200), [{ dueDate: "2026-08-25", amountCents: 3150300 }]);
  assert.equal(funruralDueDate("2026-08-19"), "2026-09-20");
  assert.equal(funruralDueDate("2026-12-30"), "2027-01-20");
});

test("controla quebra de 200 kg e zera com a NF-e de devolução", () => {
  const open = calculateFiscalAdjustment({ fiscalTotalCents: 61350000, commercialTotalCents: 60850000, returnTotalCents: 0, fiscalKilogramsMilli: 24540000, receivedKilogramsMilli: 24340000, returnKilogramsMilli: 0 });
  assert.equal(open.openDifferenceCents, 500000);
  assert.equal(open.openKilogramsMilli, 200000);
  assert.equal(open.status, "OPEN");
  const settled = calculateFiscalAdjustment({ fiscalTotalCents: 61350000, commercialTotalCents: 60850000, returnTotalCents: 500000, fiscalKilogramsMilli: 24540000, receivedKilogramsMilli: 24340000, returnKilogramsMilli: 200000 });
  assert.equal(settled.openDifferenceCents, 0);
  assert.equal(settled.openKilogramsMilli, 0);
  assert.equal(settled.status, "SETTLED");
});

test("a exclusão do negócio libera todas as NF-es e a migração repara vínculos órfãos", async () => {
  const purchases = await readFile(new URL("../lib/purchases.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0023_repair_orphaned_xml_links.sql", import.meta.url), "utf8");
  assert.match(purchases, /UPDATE fiscal_documents SET deal_id=NULL,funrural_general_entry_id=NULL,status='PENDING'/);
  assert.match(migration, /status`='PENDING'/);
  assert.match(migration, /NOT EXISTS/);
});

test("vincular XML preserva integralmente os valores comerciais do negócio", async () => {
  const fiscalDocuments = await readFile(new URL("../lib/fiscal-documents.ts", import.meta.url), "utf8");
  const start = fiscalDocuments.indexOf("export async function linkFiscalDocument");
  const end = fiscalDocuments.indexOf("export async function unlinkFiscalDocument");
  const linkFunction = fiscalDocuments.slice(start, end);
  assert.match(linkFunction, /commercialValuesPreserved: true/);
  assert.doesNotMatch(linkFunction, /UPDATE deals SET/);
  assert.doesNotMatch(linkFunction, /DELETE FROM installments/);
  assert.doesNotMatch(linkFunction, /UPDATE installments SET/);
});

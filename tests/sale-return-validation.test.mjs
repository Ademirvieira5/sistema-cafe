import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { saleReturnSchema } from "../lib/validation.ts";

test("valida devolução fiscal com pagamento opcional", async () => {
  assert.deepEqual(saleReturnSchema.parse({ dealId: "venda-1", financialTreatment: "FISCAL_ONLY" }), { dealId: "venda-1", financialTreatment: "FISCAL_ONLY" });
  assert.equal(saleReturnSchema.safeParse({ dealId: "venda-1", financialTreatment: "REFUND_PAYABLE" }).success, false);
  assert.equal(saleReturnSchema.safeParse({ dealId: "venda-1", financialTreatment: "REFUND_PAYABLE", dueDate: "2026-08-19" }).success, true);
  const migration = await readFile(new URL("../drizzle/0024_fiscal_weight_adjustments.sql", import.meta.url), "utf8");
  assert.match(migration, /adjustment_deal_id/);
});

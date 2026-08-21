import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const fiscal = fs.readFileSync(new URL("../lib/fiscal-documents.ts", import.meta.url), "utf8");
const purchases = fs.readFileSync(new URL("../lib/purchases.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../components/purchase-workspace.tsx", import.meta.url), "utf8");

test("desvincula somente o XML selecionado sem apagar negócio ou baixas", () => {
  assert.match(fiscal, /UPDATE fiscal_documents SET deal_id=NULL,funrural_general_entry_id=NULL,status='PENDING'/);
  assert.doesNotMatch(fiscal.slice(fiscal.indexOf("export async function unlinkFiscalDocument")), /DELETE FROM deals/);
  assert.doesNotMatch(fiscal.slice(fiscal.indexOf("export async function unlinkFiscalDocument")), /DELETE FROM settlements/);
});

test("negócio retorna a lista completa e oferece desvinculação individual", () => {
  assert.match(purchases, /FROM fiscal_documents WHERE status='LINKED' AND \(\(deal_id IN/);
  assert.match(workspace, /NF-es vinculadas/);
  assert.match(workspace, /document\.id\}\?dealId=/);
  assert.match(workspace, /Desvincular/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isCoffeeItems, normalizeExpenseInstallments } from "../lib/fiscal-expenses.ts";

test("distingue café de materiais e utensílios da empresa", () => {
  assert.equal(isCoffeeItems([{ description: "CAFE BENEFICIADO EM GRAO", ncm: "09011110" }]), true);
  assert.equal(isCoffeeItems([{ description: "FITA ISOLANTE PRETA 18 X 20", ncm: "39191010" }, { description: "LIMPA CONTATO", ncm: "38140090" }]), false);
});

test("preserva quatro boletos do XML e ajusta centavos ao total da NF-e", () => {
  const parts = normalizeExpenseInstallments([
    { number: "001", dueDate: "2026-09-18", amount: 563.75 },
    { number: "002", dueDate: "2026-10-18", amount: 563.75 },
    { number: "003", dueDate: "2026-11-18", amount: 563.75 },
    { number: "004", dueDate: "2026-12-18", amount: 563.74 },
  ], 225499, "2026-08-18");
  assert.equal(parts.length, 4);
  assert.equal(parts.reduce((sum, part) => sum + part.amountCents, 0), 225499);
  assert.deepEqual(parts.map((part) => part.dueDate), ["2026-09-18", "2026-10-18", "2026-11-18", "2026-12-18"]);
});

test("fluxo cria contas parceladas e só exclui XML sem vínculo", () => {
  const fiscal = readFileSync(new URL("../lib/fiscal-documents.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/xml-workspace.tsx", import.meta.url), "utf8");
  assert.match(fiscal, /POST_EXPENSE/);
  assert.match(fiscal, /XML-EXPENSE:/);
  assert.match(fiscal, /XML_DELETE_LINKED/);
  assert.match(fiscal, /DELETE FROM fiscal_documents WHERE id=\? AND status='PENDING'/);
  assert.match(workspace, /Compra para uso da empresa/);
  assert.match(workspace, /Criar \$\{document\.installments\.length \|\| 1\} conta\(s\) a pagar/);
  assert.match(workspace, /Excluir XML/);
});

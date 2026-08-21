import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const purchases = fs.readFileSync(new URL("../lib/purchases.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../components/purchase-workspace.tsx", import.meta.url), "utf8");

test("lista de negócios pagina no servidor e separa saldos abertos de quitados", () => {
  assert.match(purchases, /LIMIT \? OFFSET \?/);
  assert.match(purchases, /i\.amount_cents>i\.paid_amount_cents/);
  assert.match(workspace, /Em aberto/);
  assert.match(workspace, /Quitados/);
  assert.match(workspace, /até 50 negócios por página/);
});

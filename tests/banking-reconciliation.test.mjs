import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bankTransactionSchema, checkBatchSettlementSchema, settlementSchema } from "../lib/validation.ts";

const settlement = {
  operationKey: "fd890b3d-e693-4b33-88bd-8ea9cb27a8f7",
  originType: "INSTALLMENT",
  originId: "installment-1",
  bankAccountId: "account-1",
  method: "PIX",
  status: "CONFIRMED",
  amount: "1.250,50",
  movementDate: "2026-08-19",
  description: "Compra de café · fornecedor · negócio #00014",
};

test("mantém a descrição bancária e exige número quando a baixa é em cheque", () => {
  const parsed = settlementSchema.parse(settlement);
  assert.equal(parsed.description, settlement.description);
  assert.equal(parsed.amount, "1250.50");
  assert.equal(settlementSchema.safeParse({ ...settlement, method: "CHECK" }).success, false);
  assert.equal(settlementSchema.safeParse({ ...settlement, method: "CHECK", checkNumber: "8741" }).success, true);
});

test("movimentação manual em cheque também exige o número", () => {
  const movement = {
    operationKey: "e1a42904-c2ed-4926-960b-655538d9c402",
    bankAccountId: "account-1",
    direction: "OUT",
    method: "CHECK",
    status: "CONFIRMED",
    dueDate: "2026-08-19",
    amount: "2500",
    counterparty: "Fornecedor",
    description: "Pagamento de café",
    categoryId: "category-1",
  };
  assert.equal(bankTransactionSchema.safeParse(movement).success, false);
  assert.equal(bankTransactionSchema.safeParse({ ...movement, checkNumber: "99" }).success, true);
});

test("lote de cheques próprios exige datas, valores e números sem repetição", () => {
  const batch={operationKey:"91cfa21e-6bc2-4e35-a0ee-cfb60ef2d588",originType:"INSTALLMENT",originId:"installment-1",bankAccountId:"account-1",status:"CONFIRMED",checks:[{checkNumber:"00123",amount:"10.000,00",issueDate:"2026-08-20",dueDate:"2026-09-20"},{checkNumber:"124",amount:"5.000,00",issueDate:"2026-08-20",dueDate:"2026-10-20"}]};
  assert.equal(checkBatchSettlementSchema.safeParse(batch).success,true);
  assert.equal(checkBatchSettlementSchema.safeParse({...batch,checks:[...batch.checks,{...batch.checks[0],checkNumber:"123"}]}).success,false);
  assert.equal(checkBatchSettlementSchema.safeParse({...batch,checks:[{...batch.checks[0],issueDate:"2026-09-20",dueDate:"2026-08-20"}]}).success,false);
});

test("grava o lote com um valor para cada coluna bancária", async () => {
  const source=await readFile(new URL("../lib/settlements.ts",import.meta.url),"utf8");
  const statement=source.match(/INSERT INTO bank_transactions\(id,bank_account_id,direction,method,status,due_date,movement_date,amount_cents,counterparty,description,document,check_number,reconciled,notes,operation_key,financial_category_id,active,created_at,updated_at\) VALUES\(([^\n]+?)\)"\)\.bind\(bankTransactionId, data\.bankAccountId, "OUT", "CHECK"/)?.[1]||"";
  assert.equal((statement.match(/\?/g)||[]).length,19);
  assert.match(source,/Date\.parse\(stamp\) \+ index/);
  assert.match(source,/optional\(data\.notes\), settlementStamp, settlementStamp/);
});

test("migração classifica compras e vendas e normaliza compensados como conciliados", async () => {
  const migration = await readFile(new URL("../drizzle/0022_banking_reconciliation_categories.sql", import.meta.url), "utf8");
  assert.match(migration, /COMPRA_CAFE/);
  assert.match(migration, /VENDA_CAFE/);
  assert.match(migration, /general_entries/);
  assert.match(migration, /SET `reconciled`=1 WHERE `status`='CLEARED'/);
});

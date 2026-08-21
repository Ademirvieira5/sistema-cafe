import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bankRoute=fs.readFileSync(new URL("../app/api/bancos/[id]/route.ts",import.meta.url),"utf8");
const purchases=fs.readFileSync(new URL("../lib/purchases.ts",import.meta.url),"utf8");
const safety=fs.readFileSync(new URL("../lib/data-safety.ts",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../drizzle/0032_long_sir_ram.sql",import.meta.url),"utf8");

test("exclusão bancária preserva a movimentação cancelada e o histórico",()=>{
  assert.match(bankRoute,/UPDATE bank_transactions SET active=0,status='CANCELLED'/);
  assert.match(bankRoute,/action,before_data,after_data/);
  assert.doesNotMatch(bankRoute,/DELETE FROM audit_logs/);
  assert.doesNotMatch(bankRoute,/DELETE FROM bank_transactions/);
});

test("exclusão de negócio oculta registros sem destruir parcelas e auditoria",()=>{
  const deletion=purchases.slice(purchases.indexOf("export async function deletePurchase"),purchases.indexOf("export async function brokerStatement"));
  assert.match(deletion,/UPDATE deals SET status='CANCELLED'/);
  assert.match(deletion,/recoverable:true/);
  assert.doesNotMatch(deletion,/DELETE FROM audit_logs/);
  assert.doesNotMatch(deletion,/DELETE FROM installments/);
  assert.doesNotMatch(deletion,/DELETE FROM deals/);
});

test("backup inclui todas as tabelas e arquivos sem sobrescrever a cópia diária",()=>{
  assert.match(safety,/ALREADY_CREATED_TODAY/);
  assert.match(safety,/CompressionStream\("gzip"\)/);
  assert.match(safety,/storedFiles:files/);
});

test("migração cria índices para consultas operacionais",()=>{
  for(const name of ["deals_status_date_idx","bank_transactions_active_status_due_idx","fiscal_documents_deal_status_idx","general_entries_active_due_idx","audit_logs_entity_created_idx"])assert.match(migration,new RegExp(name));
});

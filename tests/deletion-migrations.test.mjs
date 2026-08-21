import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function runMigration(db, path) {
  for (const statement of readFileSync(path, "utf8").split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
}

test("remove somente os dois lançamentos bancários de teste cancelados", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE bank_transactions(id TEXT PRIMARY KEY,status TEXT,amount_cents INTEGER,counterparty TEXT,description TEXT); CREATE TABLE settlements(id TEXT,bank_transaction_id TEXT); CREATE TABLE broker_commission_payments(id TEXT,bank_transaction_id TEXT); CREATE TABLE audit_logs(id TEXT,entity_type TEXT,entity_id TEXT);");
  const transaction = db.prepare("INSERT INTO bank_transactions VALUES(?,?,?,?,?)");
  for (const id of ["a8d9b399-f240-4889-abcb-90c91768c939", "a0c1e96b-19e8-422c-8a62-ca6db9d73319"]) {
    transaction.run(id, "CANCELLED", 50000000, "COFFEA", "Venda café coffea");
  }
  transaction.run("keep-me", "CANCELLED", 50000000, "OUTRO", "Venda café coffea");
  runMigration(db, "drizzle/0018_delete_cancelled_test_transactions.sql");
  assert.deepEqual(db.prepare("SELECT id FROM bank_transactions ORDER BY id").all().map(row => row.id), ["keep-me"]);
});

test("remove o negócio de teste cancelado e todos os seus vínculos locais", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE deals(id TEXT PRIMARY KEY,sequence INTEGER,business_type TEXT,status TEXT,total_amount_cents INTEGER); CREATE TABLE installments(id TEXT PRIMARY KEY,deal_id TEXT); CREATE TABLE deal_brokers(id TEXT PRIMARY KEY,deal_id TEXT); CREATE TABLE audit_logs(id TEXT,entity_type TEXT,entity_id TEXT);");
  const deal = db.prepare("INSERT INTO deals VALUES(?,?,?,?,?)");
  deal.run("46dcc010-a713-41d4-846a-1feb1da9b74b", 10, "PURCHASE", "CANCELLED", 11500000);
  deal.run("keep-me", 12, "SALE", "OPEN", 11500000);
  db.prepare("INSERT INTO installments VALUES(?,?)").run("part-test", "46dcc010-a713-41d4-846a-1feb1da9b74b");
  db.prepare("INSERT INTO installments VALUES(?,?)").run("part-keep", "keep-me");
  db.prepare("INSERT INTO deal_brokers VALUES(?,?)").run("broker-test", "46dcc010-a713-41d4-846a-1feb1da9b74b");
  db.prepare("INSERT INTO audit_logs VALUES(?,?,?)").run("audit-test", "Deal", "46dcc010-a713-41d4-846a-1feb1da9b74b");
  db.prepare("INSERT INTO audit_logs VALUES(?,?,?)").run("audit-part", "Installment", "part-test");
  runMigration(db, "drizzle/0019_delete_cancelled_test_deal.sql");
  assert.deepEqual(db.prepare("SELECT id FROM deals ORDER BY id").all().map(row => row.id), ["keep-me"]);
  assert.deepEqual(db.prepare("SELECT id FROM installments ORDER BY id").all().map(row => row.id), ["part-keep"]);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM deal_brokers").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs").get().count, 0);
});

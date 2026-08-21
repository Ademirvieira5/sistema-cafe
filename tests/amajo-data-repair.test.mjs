import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function runMigration(db, path) {
  for (const statement of readFileSync(path, "utf8").split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
}

function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE people(id TEXT PRIMARY KEY, legal_name TEXT, trade_name TEXT);
    CREATE TABLE deals(
      id TEXT PRIMARY KEY, sequence INTEGER, business_type TEXT, status TEXT, party_id TEXT,
      kilograms_milli INTEGER, contracted_kilograms_milli INTEGER, received_kilograms_milli INTEGER,
      price_per_sack_cents INTEGER, gross_amount_cents INTEGER, adjustment_amount_cents INTEGER,
      total_amount_cents INTEGER, commission_amount_cents INTEGER, commission_mode TEXT,
      commission_value TEXT, updated_at TEXT
    );
    CREATE TABLE deal_brokers(
      id TEXT PRIMARY KEY, deal_id TEXT, commission_mode TEXT, commission_value TEXT,
      commission_amount_cents INTEGER, updated_at TEXT
    );
    CREATE TABLE installments(
      id TEXT PRIMARY KEY, deal_id TEXT, amount_cents INTEGER, paid_amount_cents INTEGER, updated_at TEXT
    );
    CREATE TABLE audit_logs(
      id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT, action TEXT,
      before_data TEXT, after_data TEXT, created_at TEXT
    );
    CREATE TABLE fiscal_documents(id TEXT PRIMARY KEY, deal_id TEXT, total_amount_cents INTEGER);
    CREATE TABLE bank_transactions(id TEXT PRIMARY KEY, amount_cents INTEGER);
    CREATE TABLE settlements(id TEXT PRIMARY KEY, bank_transaction_id TEXT, amount_cents INTEGER);
  `);
  return db;
}

test("restaura somente a venda 00011 da Amajo e preserva vínculos", () => {
  const db = createDatabase();
  db.prepare("INSERT INTO people VALUES(?,?,?)").run("amajo", "CAFES AMAJO E TONINHO IND. E COM. LTDA", null);
  db.prepare("INSERT INTO people VALUES(?,?,?)").run("outra", "OUTRA EMPRESA", null);
  const insertDeal = db.prepare("INSERT INTO deals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  insertDeal.run("deal-amajo", 11, "SALE", "OPEN", "amajo", 480000, 480000, 480000, 115000, 920000, 0, 920000, 4600, "PERCENT", "0.5", "antes");
  insertDeal.run("deal-outra", 11, "SALE", "OPEN", "outra", 480000, 480000, 480000, 115000, 920000, 0, 920000, 4600, "PERCENT", "0.5", "antes");
  db.prepare("INSERT INTO deal_brokers VALUES(?,?,?,?,?,?)").run("broker-amajo", "deal-amajo", "PERCENT", "0.5", 4600, "antes");
  db.prepare("INSERT INTO installments VALUES(?,?,?,?,?)").run("parcel-amajo", "deal-amajo", 920000, 0, "antes");
  db.prepare("INSERT INTO fiscal_documents VALUES(?,?,?)").run("xml-amajo", "deal-amajo", 920000);
  db.prepare("INSERT INTO bank_transactions VALUES(?,?)").run("bank-amajo", 10000);
  db.prepare("INSERT INTO settlements VALUES(?,?,?)").run("settlement-amajo", "bank-amajo", 10000);

  runMigration(db, "drizzle/0029_restore_amajo_sale_00011.sql");

  const repaired = db.prepare("SELECT * FROM deals WHERE id='deal-amajo'").get();
  assert.equal(repaired.kilograms_milli, 6000000);
  assert.equal(repaired.contracted_kilograms_milli, 6000000);
  assert.equal(repaired.received_kilograms_milli, null);
  assert.equal(repaired.price_per_sack_cents, 115000);
  assert.equal(repaired.total_amount_cents, 11500000);
  assert.equal(repaired.commission_amount_cents, 57500);
  assert.equal(db.prepare("SELECT amount_cents FROM installments WHERE id='parcel-amajo'").get().amount_cents, 11500000);
  assert.equal(db.prepare("SELECT commission_amount_cents FROM deal_brokers WHERE id='broker-amajo'").get().commission_amount_cents, 57500);
  assert.equal(db.prepare("SELECT deal_id FROM fiscal_documents WHERE id='xml-amajo'").get().deal_id, "deal-amajo");
  assert.equal(db.prepare("SELECT COUNT(*) count FROM bank_transactions").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM settlements").get().count, 1);
  assert.equal(db.prepare("SELECT action FROM audit_logs").get().action, "DATA_REPAIR_AMAJO_00011");
  assert.equal(db.prepare("SELECT kilograms_milli FROM deals WHERE id='deal-outra'").get().kilograms_milli, 480000);
});

test("não redistribui parcelas quando o negócio possui mais de uma", () => {
  const db = createDatabase();
  db.prepare("INSERT INTO people VALUES(?,?,?)").run("amajo", "CAFES AMAJO LTDA", null);
  db.prepare("INSERT INTO deals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("deal-amajo", 11, "SALE", "OPEN", "amajo", 480000, 480000, 480000, 115000, 920000, 0, 920000, 4600, "PERCENT", "0.5", "antes");
  db.prepare("INSERT INTO installments VALUES(?,?,?,?,?)").run("p1", "deal-amajo", 400000, 0, "antes");
  db.prepare("INSERT INTO installments VALUES(?,?,?,?,?)").run("p2", "deal-amajo", 520000, 0, "antes");

  runMigration(db, "drizzle/0029_restore_amajo_sale_00011.sql");

  assert.deepEqual(
    db.prepare("SELECT amount_cents FROM installments ORDER BY id").all().map((row) => row.amount_cents),
    [400000, 520000],
  );
});

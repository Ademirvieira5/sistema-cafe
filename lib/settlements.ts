import { cents, id, money, now, optional, d1 } from "@/lib/d1";
import { checkBatchSettlementSchema, settlementSchema } from "@/lib/validation";
import { nextRecurringTax } from "@/lib/financial-rules";

type Origin = { id: string; dueDate: string; amountCents: number; paidAmountCents: number; direction: "IN" | "OUT"; counterparty: string; description: string; categoryId: string | null; operationKey:string|null };

async function findOrigin(originType: "INSTALLMENT" | "GENERAL_ENTRY", originId: string): Promise<Origin | null> {
  const db = d1();
  if (originType === "INSTALLMENT") {
    return (await db.prepare(`SELECT i.id, i.due_date dueDate, i.amount_cents amountCents, i.paid_amount_cents paidAmountCents,
      CASE WHEN d.business_type='PURCHASE' THEN 'OUT' ELSE 'IN' END direction, p.legal_name counterparty,
      CASE WHEN d.business_type='PURCHASE' THEN 'Compra de café' ELSE 'Venda de café' END || ' · ' || p.legal_name || ' · negócio #' || printf('%05d', d.sequence) description,
      NULL categoryId, NULL operationKey
      FROM installments i JOIN deals d ON d.id=i.deal_id JOIN people p ON p.id=d.party_id WHERE i.id=? AND d.status='OPEN'`).bind(originId).first<Origin>()) ?? null;
  }
  return (await db.prepare(`SELECT g.id, g.due_date dueDate, g.amount_cents amountCents, g.paid_amount_cents paidAmountCents,
    CASE WHEN g.direction='PAYABLE' THEN 'OUT' ELSE 'IN' END direction, COALESCE(p.legal_name, 'Sem pessoa vinculada') counterparty, g.description description, g.category_id categoryId, g.operation_key operationKey
    FROM general_entries g LEFT JOIN people p ON p.id=g.person_id WHERE g.id=? AND g.active=1`).bind(originId).first<Origin>()) ?? null;
}

async function coffeeCategory(db: ReturnType<typeof d1>, direction: "IN" | "OUT") {
  const code = direction === "OUT" ? "COMPRA_CAFE" : "VENDA_CAFE", name = direction === "OUT" ? "Compra de café" : "Venda de café", type = direction === "OUT" ? "EXPENSE" : "INCOME";
  let category = await db.prepare("SELECT id FROM financial_categories WHERE code=? LIMIT 1").bind(code).first<{ id: string }>();
  if (!category) {
    const categoryId = id(), stamp = now();
    await db.prepare("INSERT OR IGNORE INTO financial_categories(id,code,name,type,description,active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)")
      .bind(categoryId, code, name, type, direction === "OUT" ? "Pagamentos de negócios de compra de café" : "Recebimentos de negócios de venda de café", stamp, stamp).run();
    category = await db.prepare("SELECT id FROM financial_categories WHERE code=? LIMIT 1").bind(code).first<{ id: string }>();
  }
  if (!category) throw new Error("CATEGORY_NOT_FOUND");
  return category.id;
}

export async function createSettlement(input: unknown) {
  const data = settlementSchema.parse(input), db = d1();
  const duplicate = await db.prepare("SELECT id,bank_transaction_id bankTransactionId,amount_cents amountCents FROM settlements WHERE operation_key=?").bind(data.operationKey).first<{id:string;bankTransactionId:string;amountCents:number}>();
  if (duplicate) return { id: duplicate.id, bankTransactionId: duplicate.bankTransactionId, amount: money(duplicate.amountCents) };
  const origin = await findOrigin(data.originType, data.originId);
  if (!origin) throw new Error("ORIGIN_NOT_FOUND");
  const amountCents = cents(data.amount), remaining = origin.amountCents - origin.paidAmountCents;
  if (amountCents > remaining) throw new Error("SETTLEMENT_EXCEEDS_BALANCE");
  const account = await db.prepare("SELECT id FROM bank_accounts WHERE id=? AND active=1").bind(data.bankAccountId).first();
  if (!account) throw new Error("BANK_ACCOUNT_NOT_FOUND");
  const categoryId = origin.categoryId || await coffeeCategory(db, origin.direction);
  const description = data.description || origin.description;
  const stamp = now(), bankTransactionId = id(), settlementId = id();
  const table = data.originType === "INSTALLMENT" ? "installments" : "general_entries";
  const statements:D1PreparedStatement[]=[
    db.prepare("INSERT INTO bank_transactions(id,bank_account_id,direction,method,status,due_date,movement_date,amount_cents,counterparty,description,document,check_number,reconciled,notes,operation_key,financial_category_id,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)").bind(bankTransactionId, data.bankAccountId, origin.direction, data.method, data.status, origin.dueDate, data.movementDate, amountCents, origin.counterparty, description, optional(data.document), optional(data.checkNumber), data.status === "CLEARED" ? 1 : 0, optional(data.notes), data.operationKey, categoryId, stamp, stamp),
    db.prepare("INSERT INTO settlements(id,origin_type,origin_id,bank_transaction_id,amount_cents,operation_key,settled_at,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(settlementId, data.originType, data.originId, bankTransactionId, amountCents, data.operationKey, data.movementDate, optional(data.notes), stamp, stamp),
    db.prepare(`UPDATE ${table} SET paid_amount_cents=paid_amount_cents+?, updated_at=? WHERE id=?`).bind(amountCents, stamp, data.originId),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'Settlement',?,'CREATE',?,?)").bind(id(), settlementId, JSON.stringify({ originType: data.originType, originId: data.originId, amount: money(amountCents), method: data.method }), stamp),
  ];
  const next=data.originType==="GENERAL_ENTRY"&&amountCents===remaining?nextRecurringTax(origin.operationKey,origin.dueDate,origin.description):null;
  if(next)statements.push(db.prepare("INSERT OR IGNORE INTO general_entries(id,direction,description,category_id,person_id,due_date,amount_cents,paid_amount_cents,fixed_monthly,operation_key,notes,active,created_at,updated_at) SELECT ?,'PAYABLE',?,category_id,person_id,?,amount_cents,0,1,?,notes,1,?,? FROM general_entries WHERE id=?").bind(id(),next.description,next.dueDate,next.operationKey,stamp,stamp,data.originId));
  await db.batch(statements);
  return { id: settlementId, bankTransactionId, amount: money(amountCents), remaining: money(remaining - amountCents) };
}

export async function createCheckBatchSettlement(input: unknown) {
  const data = checkBatchSettlementSchema.parse(input), db = d1();
  const existing = await db.prepare("SELECT COUNT(*) count,SUM(amount_cents) total FROM settlements WHERE operation_key LIKE ?").bind(`${data.operationKey}:%`).first<{count:number;total:number|null}>();
  if (Number(existing?.count)) return { count: Number(existing?.count), total: money(Number(existing?.total || 0)), duplicate: true };
  const origin = await findOrigin(data.originType, data.originId);
  if (!origin) throw new Error("ORIGIN_NOT_FOUND");
  if (origin.direction !== "OUT") throw new Error("OWN_CHECK_PAYABLE_ONLY");
  const account = await db.prepare("SELECT id FROM bank_accounts WHERE id=? AND active=1").bind(data.bankAccountId).first();
  if (!account) throw new Error("BANK_ACCOUNT_NOT_FOUND");
  const amounts = data.checks.map(check => cents(check.amount));
  const totalCents = amounts.reduce((sum, amount) => sum + amount, 0), remaining = origin.amountCents - origin.paidAmountCents;
  if (totalCents > remaining) throw new Error("SETTLEMENT_EXCEEDS_BALANCE");
  const normalizedNumbers = data.checks.map(check => check.checkNumber.replace(/^0+/, "") || "0");
  const placeholders = normalizedNumbers.map(() => "?").join(",");
  const duplicate = await db.prepare(`SELECT check_number checkNumber FROM bank_transactions WHERE bank_account_id=? AND method='CHECK' AND active=1 AND ltrim(check_number,'0') IN (${placeholders}) LIMIT 1`).bind(data.bankAccountId, ...normalizedNumbers).first<{checkNumber:string}>();
  if (duplicate) throw new Error("OWN_CHECK_DUPLICATE");
  const categoryId = origin.categoryId || await coffeeCategory(db, origin.direction);
  const description = data.description || origin.description, stamp = now();
  const table = data.originType === "INSTALLMENT" ? "installments" : "general_entries";
  const statements: D1PreparedStatement[] = [];
  data.checks.forEach((check, index) => {
    const bankTransactionId = id(), settlementId = id(), operationKey = `${data.operationKey}:${index + 1}`, amountCents = amounts[index];
    const settlementStamp = new Date(Date.parse(stamp) + index).toISOString();
    statements.push(
      db.prepare("INSERT INTO bank_transactions(id,bank_account_id,direction,method,status,due_date,movement_date,amount_cents,counterparty,description,document,check_number,reconciled,notes,operation_key,financial_category_id,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(bankTransactionId, data.bankAccountId, "OUT", "CHECK", data.status, check.dueDate, check.issueDate, amountCents, origin.counterparty, description, optional(data.document), check.checkNumber, data.status === "CLEARED" ? 1 : 0, optional(data.notes), operationKey, categoryId, 1, stamp, stamp),
      db.prepare("INSERT INTO settlements(id,origin_type,origin_id,bank_transaction_id,amount_cents,operation_key,settled_at,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(settlementId, data.originType, data.originId, bankTransactionId, amountCents, operationKey, check.issueDate, optional(data.notes), settlementStamp, settlementStamp),
      db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'Settlement',?,'CREATE',?,?)").bind(id(), settlementId, JSON.stringify({ originType: data.originType, originId: data.originId, amount: money(amountCents), method: "CHECK", checkNumber: check.checkNumber, batch: data.operationKey }), stamp),
    );
  });
  statements.push(db.prepare(`UPDATE ${table} SET paid_amount_cents=paid_amount_cents+?,updated_at=? WHERE id=?`).bind(totalCents, stamp, data.originId));
  const next=data.originType==="GENERAL_ENTRY"&&totalCents===remaining?nextRecurringTax(origin.operationKey,origin.dueDate,origin.description):null;
  if(next)statements.push(db.prepare("INSERT OR IGNORE INTO general_entries(id,direction,description,category_id,person_id,due_date,amount_cents,paid_amount_cents,fixed_monthly,operation_key,notes,active,created_at,updated_at) SELECT ?,'PAYABLE',?,category_id,person_id,?,amount_cents,0,1,?,notes,1,?,? FROM general_entries WHERE id=?").bind(id(),next.description,next.dueDate,next.operationKey,stamp,stamp,data.originId));
  await db.batch(statements);
  return { count: data.checks.length, total: money(totalCents), remaining: money(remaining - totalCents) };
}

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { cents, d1, id, money, now, optional } from "@/lib/d1";
import { bankTransactionSchema } from "@/lib/validation";

function transaction(row: Record<string, unknown>) {
  return {
    id: row.id, bankAccountId: row.bank_account_id, bankName: row.bank_name,
    accountNumber: row.account_number, direction: row.direction, method: row.method,
    status: row.status, dueDate: row.due_date, movementDate: row.movement_date,
    amount: money(Number(row.amount_cents)), counterparty: row.counterparty,
    description: row.description, document: row.document, checkNumber: row.check_number,
    reconciled: Boolean(row.reconciled), notes: row.notes, operationKey: row.operation_key,
    originType: row.cheque_id ? "CHECK" : row.settlement_id ? "SETTLEMENT" : row.broker_payment_id ? "BROKER_PAYMENT" : row.transfer_group_id ? "TRANSFER" : "MANUAL",
    category: row.category_id ? { id: row.category_id, code: row.category_code, name: row.category_name } : null,
  };
}

export async function GET(request: Request) {
  try {
    const db = d1();
    const url = new URL(request.url);
    const accountId = url.searchParams.get("conta");
    const status = url.searchParams.get("status");
    const reconciliation = url.searchParams.get("conciliacao");
    const q = `%${url.searchParams.get("busca")?.trim() ?? ""}%`;
    const accounts = await db.prepare(`
      SELECT a.id,a.bank_name,a.account_number,a.description,a.opening_balance_cents,
        a.opening_balance_cents + COALESCE(SUM(CASE WHEN t.active=1 AND t.status IN ('CONFIRMED','CLEARED') THEN CASE WHEN t.direction='IN' THEN t.amount_cents ELSE -t.amount_cents END ELSE 0 END),0) realized_cents,
        a.opening_balance_cents + COALESCE(SUM(CASE WHEN t.active=1 AND t.status='CLEARED' AND t.reconciled=1 THEN CASE WHEN t.direction='IN' THEN t.amount_cents ELSE -t.amount_cents END ELSE 0 END),0) reconciled_cents,
        COALESCE(SUM(CASE WHEN t.active=1 AND t.status='CONFIRMED' AND t.reconciled=0 THEN ABS(t.amount_cents) ELSE 0 END),0) pending_reconciliation_cents,
        COALESCE(SUM(CASE WHEN t.active=1 AND t.status='CONFIRMED' AND t.reconciled=0 THEN 1 ELSE 0 END),0) pending_reconciliation_count,
        a.opening_balance_cents + COALESCE(SUM(CASE WHEN t.active=1 AND t.status<>'CANCELLED' THEN CASE WHEN t.direction='IN' THEN t.amount_cents ELSE -t.amount_cents END ELSE 0 END),0) projected_cents
      FROM bank_accounts a LEFT JOIN bank_transactions t ON t.bank_account_id=a.id
      WHERE a.active=1 GROUP BY a.id ORDER BY a.bank_name,a.account_number`).all();
    const categories = await db.prepare("SELECT id,code,name,type FROM financial_categories WHERE active=1 ORDER BY name").all();
    const rows = await db.prepare(`SELECT t.*,a.bank_name,a.account_number,c.id category_id,c.code category_code,c.name category_name,s.id settlement_id,cp.id broker_payment_id,ch.id cheque_id FROM bank_transactions t JOIN bank_accounts a ON a.id=t.bank_account_id LEFT JOIN financial_categories c ON c.id=t.financial_category_id LEFT JOIN settlements s ON s.bank_transaction_id=t.id LEFT JOIN broker_commission_payments cp ON cp.bank_transaction_id=t.id LEFT JOIN cheques ch ON ch.bank_transaction_id=t.id
      WHERE t.active=1 AND t.status<>'CANCELLED' AND (? IS NULL OR t.bank_account_id=?) AND (? IS NULL OR t.status=?)
      AND (? IS NULL OR (?='PENDING' AND t.status='CONFIRMED' AND t.reconciled=0) OR (?='RECONCILED' AND t.status='CLEARED' AND t.reconciled=1))
      AND (t.counterparty LIKE ? OR t.description LIKE ? OR COALESCE(t.document,'') LIKE ?)
      ORDER BY t.due_date DESC,t.created_at DESC LIMIT 500`).bind(accountId,accountId,status,status,reconciliation,reconciliation,reconciliation,q,q,q).all();
    return NextResponse.json({
      accounts: accounts.results.map(a=>({id:a.id,bankName:a.bank_name,accountNumber:a.account_number,description:a.description,openingBalance:money(Number(a.opening_balance_cents)),realizedBalance:money(Number(a.realized_cents)),reconciledBalance:money(Number(a.reconciled_cents)),pendingReconciliation:money(Number(a.pending_reconciliation_cents)),pendingCount:Number(a.pending_reconciliation_count),difference:money(Number(a.realized_cents)-Number(a.reconciled_cents)),projectedBalance:money(Number(a.projected_cents))})),
      categories: categories.results,
      transactions: rows.results.map(transaction),
    });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const x = bankTransactionSchema.parse(await request.json());
    const db=d1();
    const duplicate=await db.prepare("SELECT id FROM bank_transactions WHERE operation_key=? AND bank_account_id=? AND direction=?").bind(x.operationKey,x.bankAccountId,x.direction).first<{id:string}>();
    if(duplicate)return NextResponse.json(duplicate,{status:200});
    if(!await db.prepare("SELECT id FROM bank_accounts WHERE id=? AND active=1").bind(x.bankAccountId).first())throw new Error("BANK_ACCOUNT_NOT_FOUND");
    const transactionId=id(),stamp=now(),movementDate=x.status==="PLANNED"?null:optional(x.movementDate)||String(x.dueDate);
    const categoryId = optional(x.categoryId);
    if (!await db.prepare("SELECT id FROM financial_categories WHERE id=? AND active=1").bind(categoryId).first()) return NextResponse.json({error:"A categoria informada não existe ou está inativa."},{status:400});
    await db.batch([
      db.prepare("INSERT INTO bank_transactions(id,bank_account_id,direction,method,status,due_date,movement_date,amount_cents,counterparty,description,document,check_number,reconciled,notes,operation_key,financial_category_id,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)").bind(transactionId,x.bankAccountId,x.direction,x.method,x.status,x.dueDate,movementDate,cents(x.amount),x.counterparty,x.description,optional(x.document),optional(x.checkNumber),x.status==="CLEARED"?1:0,optional(x.notes),x.operationKey,categoryId,stamp,stamp),
      db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'BankTransaction',?,'CREATE',?,?)").bind(id(),transactionId,JSON.stringify({amount:x.amount,direction:x.direction,method:x.method}),stamp),
    ]);
    return NextResponse.json({id:transactionId},{status:201});
  } catch(error){return apiError(error)}
}

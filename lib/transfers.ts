import { cents, d1, id, now, optional } from "@/lib/d1";
import { transferSchema } from "@/lib/validation";

export async function createTransfer(input: unknown) {
  const data = transferSchema.parse(input), db = d1();
  const duplicate = await db.prepare("SELECT transfer_group_id id FROM bank_transactions WHERE operation_key=? AND transfer_group_id IS NOT NULL LIMIT 1").bind(data.operationKey).first<{id:string}>();
  if (duplicate) return duplicate;
  const accounts = await db.prepare("SELECT id,bank_name bankName,account_number accountNumber FROM bank_accounts WHERE id IN (?,?) AND active=1").bind(data.sourceAccountId, data.destinationAccountId).all();
  if (accounts.results.length !== 2) throw new Error("BANK_ACCOUNT_NOT_FOUND");
  const source = accounts.results.find((account) => account.id === data.sourceAccountId)!;
  const destination = accounts.results.find((account) => account.id === data.destinationAccountId)!;
  const stamp = now(), groupId = id(), amountCents = cents(data.amount);
  await db.batch([
    db.prepare("INSERT INTO bank_transactions(id,bank_account_id,direction,method,status,due_date,movement_date,amount_cents,counterparty,description,document,reconciled,notes,transfer_group_id,operation_key,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id(), source.id, "OUT", "TRANSFER", data.status, data.movementDate, data.movementDate, amountCents, destination.bankName, `Transferência para ${destination.bankName} · ${destination.accountNumber}`, optional(data.document), data.status === "CLEARED" ? 1 : 0, optional(data.notes), groupId, data.operationKey, 1, stamp, stamp),
    db.prepare("INSERT INTO bank_transactions(id,bank_account_id,direction,method,status,due_date,movement_date,amount_cents,counterparty,description,document,reconciled,notes,transfer_group_id,operation_key,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id(), destination.id, "IN", "TRANSFER", data.status, data.movementDate, data.movementDate, amountCents, source.bankName, `Transferência de ${source.bankName} · ${source.accountNumber}`, optional(data.document), data.status === "CLEARED" ? 1 : 0, optional(data.notes), groupId, data.operationKey, 1, stamp, stamp),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'BankTransfer',?,'CREATE',?,?)").bind(id(), groupId, JSON.stringify({ amount: data.amount, source: source.id, destination: destination.id }), stamp),
  ]);
  return { id: groupId };
}

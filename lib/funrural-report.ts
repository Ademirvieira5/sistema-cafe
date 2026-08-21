import { cents, d1, id, money, now, optional } from "@/lib/d1";
import { funruralDueDate, funruralReconciliationStatus } from "@/lib/financial-rules";
import { ensureFunruralMonthlyEntry, recalculateFunruralEntry } from "@/lib/funrural";

const validCompetence = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export async function funruralReport(competence: string) {
  if (!validCompetence(competence)) throw new Error("FUNRURAL_COMPETENCE_INVALID");
  const db = d1();
  const [documents, period, guides, accounts, entry] = await Promise.all([
    db.prepare(`SELECT f.id,f.document_number documentNumber,f.issue_date issueDate,f.total_amount_cents grossCents,
      f.funrural_rate rate,f.funrural_amount_cents retentionCents,f.status,p.legal_name producer,
      d.sequence dealSequence
      FROM fiscal_documents f JOIN people p ON p.id=f.party_id
      LEFT JOIN deals d ON d.id=f.deal_id
      WHERE f.business_type='PURCHASE' AND f.funrural_detected=1 AND f.issue_date LIKE ?
      ORDER BY f.issue_date,f.document_number`).bind(`${competence}-%`).all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM funrural_periods WHERE competence=?").bind(competence).first<Record<string, unknown>>(),
    db.prepare("SELECT id,original_filename originalFilename,document_number documentNumber,amount_cents amountCents,status FROM imported_documents WHERE document_type='DARF' AND (competence=? OR competence IS NULL) ORDER BY created_at DESC").bind(competence).all<Record<string, unknown>>(),
    db.prepare("SELECT id,bank_name bankName,account_number accountNumber FROM bank_accounts WHERE active=1 ORDER BY bank_name,account_number").all<Record<string, unknown>>(),
    db.prepare("SELECT id,due_date dueDate,amount_cents amountCents,paid_amount_cents paidAmountCents FROM general_entries WHERE operation_key=? LIMIT 1").bind(`FUNRURAL:${competence}`).first<Record<string, unknown>>(),
  ]);
  const rows = documents.results.map(row => {
    const grossCents = Number(row.grossCents || 0), retentionCents = Number(row.retentionCents || 0);
    return { id: String(row.id), documentNumber: String(row.documentNumber), issueDate: String(row.issueDate), producer: String(row.producer), dealSequence: row.dealSequence == null ? null : Number(row.dealSequence), status: String(row.status), gross: money(grossCents), rate: row.rate == null ? null : Number(row.rate), retention: money(retentionCents), net: money(grossCents - retentionCents) };
  });
  const linkedRows = documents.results.filter(row => row.status === "LINKED");
  const grossCents = linkedRows.reduce((sum, row) => sum + Number(row.grossCents || 0), 0);
  const calculatedCents = linkedRows.reduce((sum, row) => sum + Number(row.retentionCents || 0), 0);
  const guideCents = period?.guide_amount_cents == null ? null : Number(period.guide_amount_cents);
  const paidCents = Number(entry?.paidAmountCents || 0), amountCents = Number(entry?.amountCents || calculatedCents);
  return {
    competence, dueDate: String(entry?.dueDate || funruralDueDate(`${competence}-01`)), documents: rows,
    totals: { documents: linkedRows.length, pendingDocuments: rows.length - linkedRows.length, gross: money(grossCents), calculated: money(calculatedCents), guide: guideCents == null ? null : money(guideCents), difference: guideCents == null ? null : money(guideCents - calculatedCents), paid: money(paidCents), balance: money(Math.max(0, amountCents - paidCents)) },
    reconciliation: { importedDocumentId: period?.imported_document_id || null, notes: period?.notes || "", confirmedAt: period?.confirmed_at || null, status: funruralReconciliationStatus(calculatedCents, guideCents, paidCents) },
    generalEntryId: entry?.id || null,
    guides: guides.results.map(row => ({ id: row.id, label: `${row.originalFilename}${row.documentNumber ? ` · ${row.documentNumber}` : ""}`, total: row.amountCents == null ? null : money(Number(row.amountCents)), status: row.status })),
    accounts: accounts.results,
  };
}

export async function saveFunruralReconciliation(competence: string, input: unknown) {
  if (!validCompetence(competence)) throw new Error("FUNRURAL_COMPETENCE_INVALID");
  const data = input as Record<string, unknown>, guideAmountCents = cents(data.guideAmount);
  if (guideAmountCents < 0) throw new Error("FUNRURAL_GUIDE_INVALID");
  const db = d1(), importedDocumentId = optional(data.importedDocumentId), stamp = now();
  if (importedDocumentId) {
    const guide = await db.prepare("SELECT id FROM imported_documents WHERE id=? AND document_type='DARF'").bind(importedDocumentId).first();
    if (!guide) throw new Error("FUNRURAL_GUIDE_NOT_FOUND");
  }
  const entryId = await ensureFunruralMonthlyEntry(db, `${competence}-01`);
  await recalculateFunruralEntry(db, entryId);
  await db.batch([
    db.prepare(`INSERT INTO funrural_periods(competence,guide_amount_cents,imported_document_id,notes,confirmed_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(competence) DO UPDATE SET guide_amount_cents=excluded.guide_amount_cents,imported_document_id=excluded.imported_document_id,notes=excluded.notes,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at`)
      .bind(competence, guideAmountCents, importedDocumentId, optional(data.notes), stamp, stamp, stamp),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'FunruralPeriod',?,'RECONCILE',?,?)")
      .bind(id(), competence, JSON.stringify({ guideAmount: money(guideAmountCents), importedDocumentId }), stamp),
  ]);
  return funruralReport(competence);
}

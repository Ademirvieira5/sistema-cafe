import { d1, id, now } from "@/lib/d1";
import { funruralCompetence, funruralDueDate } from "@/lib/financial-rules";

function competenceLabel(competence: string) {
  const [year, month] = competence.split("-");
  return `${month}/${year}`;
}

export async function ensureFunruralMonthlyEntry(db: ReturnType<typeof d1>, issueDate: string) {
  const competence = funruralCompetence(issueDate), operationKey = `FUNRURAL:${competence}`, stamp = now();
  await db.prepare("INSERT OR IGNORE INTO financial_categories(id,code,name,type,description,active,created_at,updated_at) VALUES(?,'FUNRURAL','FUNRURAL','EXPENSE','Retenções sobre compras de produtores rurais',1,?,?)")
    .bind(id(), stamp, stamp).run();
  const category = await db.prepare("SELECT id FROM financial_categories WHERE code='FUNRURAL' LIMIT 1").first<{ id: string }>();
  if (!category) throw new Error("CATEGORY_NOT_FOUND");
  await db.prepare("INSERT OR IGNORE INTO general_entries(id,direction,description,category_id,person_id,due_date,amount_cents,paid_amount_cents,fixed_monthly,operation_key,notes,active,created_at,updated_at) VALUES(?,'PAYABLE',?,?,NULL,?,0,0,0,?,?,1,?,?)")
    .bind(id(), `Funrural · competência ${competenceLabel(competence)}`, category.id, funruralDueDate(issueDate), operationKey, "Gerado automaticamente pelas retenções confirmadas nos XMLs de compras de produtores. O valor é comparado depois com a guia/DCTFWeb.", stamp, stamp).run();
  const entry = await db.prepare("SELECT id FROM general_entries WHERE operation_key=? LIMIT 1").bind(operationKey).first<{ id: string }>();
  if (!entry) throw new Error("FUNRURAL_ENTRY_NOT_FOUND");
  return entry.id;
}

export async function recalculateFunruralEntry(db: ReturnType<typeof d1>, entryId: string) {
  const stamp = now();
  await db.prepare("UPDATE general_entries SET amount_cents=MAX(paid_amount_cents,(SELECT COALESCE(SUM(funrural_amount_cents),0) FROM fiscal_documents WHERE funrural_general_entry_id=? AND status='LINKED')),active=CASE WHEN paid_amount_cents>0 OR (SELECT COALESCE(SUM(funrural_amount_cents),0) FROM fiscal_documents WHERE funrural_general_entry_id=? AND status='LINKED')>0 THEN 1 ELSE 0 END,updated_at=? WHERE id=?")
    .bind(entryId, entryId, stamp, entryId).run();
}

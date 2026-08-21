import { cents, d1, id, kilograms, kilogramsMilli, money, now } from "@/lib/d1";
import { classifyNfe, NfeClassification, NfeParty, ParsedNfe, parseNfeXml } from "@/lib/nfe-xml";
import { calculateFiscalAdjustment } from "@/lib/fiscal-aggregation";
import { ensureFunruralMonthlyEntry, recalculateFunruralEntry } from "@/lib/funrural";
import { isCoffeeItems, normalizeExpenseInstallments } from "@/lib/fiscal-expenses";

type BusinessType = "PURCHASE" | "SALE";
type FiscalPurpose = "DEAL" | "SALE_RETURN" | "PURCHASE_RETURN" | "TRANSFER" | "REVIEW";

function bucket() {
  const value = (globalThis as typeof globalThis & { __SISTEMA_CAFE_BUCKET?: R2Bucket }).__SISTEMA_CAFE_BUCKET;
  if (!value) throw new Error("XML_STORAGE_UNAVAILABLE");
  return value;
}

function record(row: Record<string, unknown>, suggestions: Record<string, unknown>[] = []) {
  const items = JSON.parse(String(row.items_json || "[]"));
  const installments = JSON.parse(String(row.installments_json || "[]"));
  const orphanedLink = row.status === "LINKED" && !row.deal_id && !row.adjustment_deal_id && !row.general_entry_id;
  const dealFiscalTotalCents = Number(row.deal_fiscal_total_cents || 0), dealFunruralCents = Number(row.deal_funrural_total_cents || 0), dealFinancialCents = Number(row.deal_total_amount_cents || 0);
  const dealFiscalKilogramsMilli = Number(row.deal_fiscal_kilograms_milli || 0), dealEffectiveKilogramsMilli = Number(row.deal_effective_kilograms_milli || 0);
  const saleAdjustment = calculateFiscalAdjustment({ fiscalTotalCents: dealFiscalTotalCents, commercialTotalCents: dealFinancialCents, returnTotalCents: Number(row.deal_return_total_cents || 0), fiscalKilogramsMilli: dealFiscalKilogramsMilli, receivedKilogramsMilli: dealEffectiveKilogramsMilli, returnKilogramsMilli: Number(row.deal_return_kilograms_milli || 0) });
  const amountDifferenceCents = row.purpose === "SALE_RETURN" ? Number(row.adjustment_open_difference_cents || 0) : row.deal_business_type === "PURCHASE" ? Math.abs(dealFiscalTotalCents - dealFunruralCents - dealFinancialCents) : saleAdjustment.openDifferenceCents;
  const kilogramDifferenceMilli = row.purpose === "SALE_RETURN" ? Number(row.adjustment_open_kilograms_milli || 0) : row.deal_business_type === "PURCHASE" ? Math.abs(dealFiscalKilogramsMilli - dealEffectiveKilogramsMilli) : saleAdjustment.openKilogramsMilli;
  const fiscalState = row.status === "PENDING" ? "OPEN" : row.status === "LINKED" && (amountDifferenceCents > 1 || kilogramDifferenceMilli > 1) ? "DIFFERENCE" : row.status === "LINKED" ? "CLOSED" : "OPEN";
  return {
    id: String(row.id), accessKey: String(row.access_key), documentNumber: String(row.document_number), series: row.series ? String(row.series) : null,
    businessType: row.business_type, issueDate: row.issue_date, partyId: row.party_id, partyName: row.party_name,
    classificationConfidence: row.classification_confidence || "CONFIRMED", classificationReason: row.classification_reason || null,
    operationNature: row.operation_nature || null, operationType: row.operation_type || null, fiscalPurpose: row.fiscal_purpose || null,
    referencedAccessKeys: JSON.parse(String(row.referenced_keys_json || "[]")),
    funrural: { detected: Boolean(row.funrural_detected), rate: row.funrural_rate == null ? null : Number(row.funrural_rate), amount: row.funrural_amount_cents == null ? null : money(Number(row.funrural_amount_cents)), source: row.funrural_source || null, officialValidation: String(row.issue_date) >= "2026-04-01" && Math.abs(Number(row.funrural_rate || 0) - 1.63) < 0.0001 ? "Conferido: 1,32% Previdência + 0,11% RAT + 0,20% Senar" : null },
    funruralGeneralEntryId: row.funrural_general_entry_id || null,
    issuerName: row.issuer_name, issuerDocument: row.issuer_document, recipientName: row.recipient_name, recipientDocument: row.recipient_document,
    productsAmount: money(Number(row.products_amount_cents)), discountAmount: money(Number(row.discount_amount_cents)), freightAmount: money(Number(row.freight_amount_cents)), otherAmount: money(Number(row.other_amount_cents)), totalAmount: money(Number(row.total_amount_cents)),
    estimatedKilograms: row.estimated_kilograms_milli == null ? null : kilograms(Number(row.estimated_kilograms_milli)),
    estimatedSacks: row.estimated_kilograms_milli == null ? null : (Number(row.estimated_kilograms_milli) / 60000).toFixed(3),
    estimatedPricePerSack: row.estimated_price_per_sack_cents == null ? null : money(Number(row.estimated_price_per_sack_cents)),
    status: orphanedLink ? "PENDING" : row.status, purpose: row.purpose || "DEAL", dealId: row.deal_id, dealSequence: row.deal_sequence, adjustmentDealId: row.adjustment_deal_id || null, adjustmentDealSequence: row.adjustment_deal_sequence || null, importedAt: row.imported_at,
    dealFiscalDocumentCount: Number(row.deal_fiscal_document_count || 0),
    dealFiscalTotal: money(Number(row.deal_fiscal_total_cents || 0)),
    dealFiscalKilograms: row.deal_fiscal_kilograms_milli == null ? null : kilograms(Number(row.deal_fiscal_kilograms_milli)),
    generalEntryId: row.general_entry_id || null, generalEntryPaidAmount: row.general_entry_paid_cents == null ? null : money(Number(row.general_entry_paid_cents)),
    originalFilename: row.original_filename, items, installments,
    isCoffeeDocument: isCoffeeItems(items), generalEntryCount: Number(row.general_entry_count || (row.general_entry_id ? 1 : 0)),
    adjustmentOpenDifference: money(Number(row.adjustment_open_difference_cents || 0)), adjustmentOpenKilograms: kilograms(Number(row.adjustment_open_kilograms_milli || 0)),
    fiscalState, fiscalDifferenceAmount: money(amountDifferenceCents), fiscalDifferenceKilograms: kilograms(kilogramDifferenceMilli),
    suggestions: suggestions.map((item) => ({ id: String(item.id), sequence: Number(item.sequence), date: String(item.date), totalAmount: money(Number(item.total_amount_cents)), kilograms: kilograms(Number(item.kilograms_milli)), documentCount: Number(item.document_count || 0), openFiscalDifference: money(Number(item.open_fiscal_difference_cents || 0)), openFiscalKilograms: kilograms(Number(item.open_fiscal_kilograms_milli || 0)) })),
  };
}

async function dealSuggestions(db: ReturnType<typeof d1>, row: Record<string, unknown>) {
  if (row.purpose === "SALE_RETURN") {
    if (row.status === "LINKED" && (row.adjustment_deal_id || row.general_entry_id)) return [];
    const result = await db.prepare("SELECT d.id,d.sequence,d.date,d.total_amount_cents,d.kilograms_milli,(SELECT COUNT(*) FROM fiscal_documents f WHERE f.deal_id=d.id AND f.status='LINKED' AND f.purpose='DEAL') document_count,MAX(0,(SELECT COALESCE(SUM(f.total_amount_cents),0) FROM fiscal_documents f WHERE f.deal_id=d.id AND f.status='LINKED' AND f.purpose='DEAL')-d.total_amount_cents-(SELECT COALESCE(SUM(r.total_amount_cents),0) FROM fiscal_documents r WHERE r.adjustment_deal_id=d.id AND r.status='LINKED' AND r.purpose='SALE_RETURN')) open_fiscal_difference_cents,MAX(0,(SELECT COALESCE(SUM(f.estimated_kilograms_milli),0) FROM fiscal_documents f WHERE f.deal_id=d.id AND f.status='LINKED' AND f.purpose='DEAL')-COALESCE(d.received_kilograms_milli,d.kilograms_milli)-(SELECT COALESCE(SUM(r.estimated_kilograms_milli),0) FROM fiscal_documents r WHERE r.adjustment_deal_id=d.id AND r.status='LINKED' AND r.purpose='SALE_RETURN')) open_fiscal_kilograms_milli FROM deals d WHERE d.party_id=? AND d.business_type='SALE' AND d.status='OPEN' AND (open_fiscal_difference_cents>0 OR open_fiscal_kilograms_milli>0) ORDER BY d.date DESC,d.sequence DESC LIMIT 10").bind(row.party_id).all();
    return result.results;
  }
  if (row.purpose !== "DEAL" || row.status === "LINKED" && (row.deal_id || row.general_entry_id)) return [];
  const result = await db.prepare("SELECT d.id,d.sequence,d.date,d.total_amount_cents,d.kilograms_milli,(SELECT COUNT(*) FROM fiscal_documents f WHERE f.deal_id=d.id AND f.status='LINKED' AND f.purpose='DEAL') document_count FROM deals d WHERE d.party_id=? AND d.business_type=? AND d.status='OPEN' ORDER BY ABS(d.total_amount_cents-?),ABS(julianday(d.date)-julianday(?)),d.sequence DESC LIMIT 10")
    .bind(row.party_id, row.business_type, row.total_amount_cents, row.issue_date).all();
  return result.results;
}

const fiscalDocumentSelect = `SELECT f.*,p.legal_name party_name,
  d.sequence deal_sequence,d.business_type deal_business_type,d.total_amount_cents deal_total_amount_cents,COALESCE(d.received_kilograms_milli,d.kilograms_milli) deal_effective_kilograms_milli,
  ad.sequence adjustment_deal_sequence,g.paid_amount_cents general_entry_paid_cents,
  (SELECT COUNT(*) FROM general_entries gx WHERE gx.active=1 AND gx.operation_key LIKE 'XML-EXPENSE:' || f.access_key || ':%') general_entry_count,
  (SELECT COUNT(*) FROM fiscal_documents fx WHERE fx.deal_id=f.deal_id AND fx.status='LINKED' AND fx.purpose='DEAL') deal_fiscal_document_count,
  (SELECT SUM(fx.total_amount_cents) FROM fiscal_documents fx WHERE fx.deal_id=f.deal_id AND fx.status='LINKED' AND fx.purpose='DEAL') deal_fiscal_total_cents,
  (SELECT SUM(fx.estimated_kilograms_milli) FROM fiscal_documents fx WHERE fx.deal_id=f.deal_id AND fx.status='LINKED' AND fx.purpose='DEAL') deal_fiscal_kilograms_milli,
  (SELECT SUM(fx.funrural_amount_cents) FROM fiscal_documents fx WHERE fx.deal_id=f.deal_id AND fx.status='LINKED' AND fx.purpose='DEAL') deal_funrural_total_cents,
  (SELECT SUM(rx.total_amount_cents) FROM fiscal_documents rx WHERE rx.adjustment_deal_id=f.deal_id AND rx.status='LINKED' AND rx.purpose='SALE_RETURN') deal_return_total_cents,
  (SELECT SUM(rx.estimated_kilograms_milli) FROM fiscal_documents rx WHERE rx.adjustment_deal_id=f.deal_id AND rx.status='LINKED' AND rx.purpose='SALE_RETURN') deal_return_kilograms_milli,
  MAX(0,(SELECT COALESCE(SUM(x.total_amount_cents),0) FROM fiscal_documents x WHERE x.deal_id=f.adjustment_deal_id AND x.status='LINKED' AND x.purpose='DEAL')-COALESCE(ad.total_amount_cents,0)-(SELECT COALESCE(SUM(x.total_amount_cents),0) FROM fiscal_documents x WHERE x.adjustment_deal_id=f.adjustment_deal_id AND x.status='LINKED' AND x.purpose='SALE_RETURN')) adjustment_open_difference_cents,
  MAX(0,(SELECT COALESCE(SUM(x.estimated_kilograms_milli),0) FROM fiscal_documents x WHERE x.deal_id=f.adjustment_deal_id AND x.status='LINKED' AND x.purpose='DEAL')-COALESCE(ad.received_kilograms_milli,ad.kilograms_milli,0)-(SELECT COALESCE(SUM(x.estimated_kilograms_milli),0) FROM fiscal_documents x WHERE x.adjustment_deal_id=f.adjustment_deal_id AND x.status='LINKED' AND x.purpose='SALE_RETURN')) adjustment_open_kilograms_milli
  FROM fiscal_documents f JOIN people p ON p.id=f.party_id LEFT JOIN deals d ON d.id=f.deal_id LEFT JOIN deals ad ON ad.id=f.adjustment_deal_id LEFT JOIN general_entries g ON g.id=f.general_entry_id`;

async function rowById(documentId: string) {
  return d1().prepare(`${fiscalDocumentSelect} WHERE f.id=?`)
    .bind(documentId).first<Record<string, unknown>>();
}

function classificationFields(classification: NfeClassification) {
  const businessType: BusinessType = classification.code === "PURCHASE" || classification.code === "SALE_RETURN" ? "PURCHASE" : "SALE";
  const purpose: FiscalPurpose = classification.code === "PURCHASE" || classification.code === "SALE" ? "DEAL" : classification.code;
  return { businessType, purpose };
}

function counterparty(parsed: ParsedNfe, classification: NfeClassification): NfeParty {
  if (classification.counterparty === "RECIPIENT") return parsed.recipient;
  if (classification.counterparty === "ISSUER") return parsed.issuer;
  return parsed.issuer.document?.startsWith("11034316") ? parsed.recipient : parsed.issuer;
}

async function findOrCreateParty(parsed: ParsedNfe, classification: NfeClassification, businessType: BusinessType, purpose: FiscalPurpose) {
  const db = d1(), party = counterparty(parsed, classification);
  if (!party.document) throw new Error("XML_PARTY_DOCUMENT_MISSING");
  const existing = await db.prepare("SELECT id FROM people WHERE cpf_cnpj=? LIMIT 1").bind(party.document).first<{ id: string }>();
  const partyId = existing?.id ?? id(), stamp = now(), ruralProducer = parsed.funrural.detected && businessType === "PURCHASE";
  const role = purpose === "SALE_RETURN" ? "CUSTOMER" : purpose === "PURCHASE_RETURN" ? "SUPPLIER" : businessType === "PURCHASE" ? "SUPPLIER" : "CUSTOMER";
  if (existing) {
    await db.batch([
      db.prepare("UPDATE people SET legal_name=CASE WHEN TRIM(legal_name)='' THEN ? ELSE legal_name END,trade_name=COALESCE(trade_name,?),rg_ie=COALESCE(rg_ie,?),phone=COALESCE(phone,?),zip_code=COALESCE(zip_code,?),street=COALESCE(street,?),number=COALESCE(number,?),complement=COALESCE(complement,?),district=COALESCE(district,?),city=COALESCE(city,?),state=COALESCE(state,?),country=COALESCE(country,?),classification=CASE WHEN ?=1 THEN 'RURAL_PRODUCER' ELSE classification END,funrural_status=CASE WHEN ?=1 AND funrural_status='NOT_APPLICABLE' THEN 'REVIEW' ELSE funrural_status END,last_invoice_at=?,last_imported_at=?,active=1,updated_at=? WHERE id=?")
        .bind(party.name, party.tradeName, party.stateRegistration, party.address.phone, party.address.zipCode, party.address.street, party.address.number, party.address.complement, party.address.district, party.address.city, party.address.state, party.address.country, ruralProducer ? 1 : 0, ruralProducer ? 1 : 0, parsed.issueDate, stamp, stamp, partyId),
      db.prepare("INSERT OR IGNORE INTO person_roles(person_id,role) VALUES(?,?)").bind(partyId, role),
    ]);
  } else {
    const isIndividual = party.document.length === 11;
    await db.batch([
      db.prepare("INSERT INTO people(id,person_type,classification,legal_name,trade_name,cpf_cnpj,rg_ie,phone,zip_code,street,number,complement,district,city,state,country,funrural_status,source,last_invoice_at,last_imported_at,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)")
        .bind(partyId, isIndividual ? "PF" : "PJ", ruralProducer || isIndividual && businessType === "PURCHASE" ? "RURAL_PRODUCER" : isIndividual ? "INDIVIDUAL" : "COMPANY", party.name, party.tradeName, party.document, party.stateRegistration, party.address.phone, party.address.zipCode, party.address.street, party.address.number, party.address.complement, party.address.district, party.address.city, party.address.state, party.address.country, ruralProducer || isIndividual && businessType === "PURCHASE" ? "REVIEW" : "NOT_APPLICABLE", "XML", parsed.issueDate, stamp, stamp, stamp),
      db.prepare("INSERT INTO person_roles(person_id,role) VALUES(?,?)").bind(partyId, role),
    ]);
  }
  return { partyId, created: !existing };
}

export async function importFiscalDocument(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("XML_TOO_LARGE");
  const xml = new TextDecoder("utf-8", { fatal: false }).decode(await file.arrayBuffer());
  const parsed = parseNfeXml(xml), classification = classifyNfe(parsed), { businessType, purpose } = classificationFields(classification), db = d1();
  const duplicate = await db.prepare("SELECT id FROM fiscal_documents WHERE access_key=?").bind(parsed.accessKey).first<{ id: string }>();
  if (duplicate) {
    const existing = await rowById(duplicate.id);
    return { document: record(existing!, await dealSuggestions(db, existing!)), duplicate: true, personCreated: false };
  }
  const { partyId, created: personCreated } = await findOrCreateParty(parsed, classification, businessType, purpose);
  const documentId = id(), stamp = now(), xmlKey = `xml/${parsed.issueDate.slice(0, 7)}/${parsed.accessKey}.xml`;
  await bucket().put(xmlKey, xml, { httpMetadata: { contentType: "application/xml; charset=utf-8" }, customMetadata: { accessKey: parsed.accessKey, originalName: file.name.slice(0, 160) } });
  const calculatedPrice = parsed.estimatedPricePerSack == null ? null : cents(parsed.estimatedPricePerSack);
  await db.batch([
    db.prepare("INSERT INTO fiscal_documents(id,access_key,document_number,series,business_type,purpose,classification_confidence,classification_reason,operation_nature,operation_type,fiscal_purpose,referenced_keys_json,funrural_detected,funrural_rate,funrural_amount_cents,funrural_source,issue_date,party_id,issuer_name,issuer_document,recipient_name,recipient_document,products_amount_cents,discount_amount_cents,freight_amount_cents,other_amount_cents,total_amount_cents,estimated_kilograms_milli,estimated_price_per_sack_cents,items_json,installments_json,xml_key,original_filename,status,imported_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',?,?,?)")
      .bind(documentId, parsed.accessKey, parsed.number, parsed.series, businessType, purpose, classification.confidence, classification.reason, parsed.operationNature || null, parsed.operationType, parsed.fiscalPurpose, JSON.stringify(parsed.referencedAccessKeys), parsed.funrural.detected ? 1 : 0, parsed.funrural.rate == null ? null : String(parsed.funrural.rate), parsed.funrural.amount == null ? null : cents(parsed.funrural.amount), parsed.funrural.source, parsed.issueDate, partyId, parsed.issuer.name, parsed.issuer.document, parsed.recipient.name, parsed.recipient.document, cents(parsed.productsTotal), cents(parsed.discount), cents(parsed.freight), cents(parsed.other), cents(parsed.total), parsed.estimatedKilograms == null ? null : kilogramsMilli(parsed.estimatedKilograms), calculatedPrice, JSON.stringify(parsed.items), JSON.stringify(parsed.installments.length ? parsed.installments : [{ number: "1", dueDate: parsed.issueDate, amount: parsed.total }]), xmlKey, file.name.slice(0, 160), stamp, stamp, stamp),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'FiscalDocument',?,'IMPORT',?,?)")
      .bind(id(), documentId, JSON.stringify({ accessKey: parsed.accessKey, number: parsed.number, classification: classification.code, confidence: classification.confidence, total: parsed.total, partyId, funrural: parsed.funrural }), stamp),
  ]);
  const inserted = await rowById(documentId);
  return { document: record(inserted!, await dealSuggestions(db, inserted!)), duplicate: false, personCreated };
}

export async function listFiscalDocuments(search = "", status = "ALL") {
  const db = d1(), query = `%${search}%`, statusFilter = ["PENDING", "LINKED", "IGNORED", "CANCELLED"].includes(status) ? status : null;
  const rows = await db.prepare(`${fiscalDocumentSelect} WHERE (? IS NULL OR f.status=?) AND (f.document_number LIKE ? OR f.access_key LIKE ? OR p.legal_name LIKE ?) ORDER BY f.issue_date DESC,f.imported_at DESC`)
    .bind(statusFilter, statusFilter, query, query, query).all();
  const mapped = await Promise.all(rows.results.map(async (row) => record(row, await dealSuggestions(db, row))));
  return ["OPEN", "CLOSED", "DIFFERENCE"].includes(status) ? mapped.filter((item) => item.fiscalState === status) : mapped;
}

export async function getFiscalDocument(documentId: string) {
  const row = await rowById(documentId);
  if (!row) throw new Error("XML_DOCUMENT_NOT_FOUND");
  return record(row, await dealSuggestions(d1(), row));
}

export async function fiscalDocumentOptions() {
  const result = await d1().prepare("SELECT id,name,type FROM financial_categories WHERE active=1 AND type IN ('EXPENSE','BOTH') ORDER BY CASE WHEN code='USO_CONSUMO' THEN 0 ELSE 1 END,name").all();
  return { expenseCategories: result.results };
}

export async function registerExpenseDocument(documentId: string, categoryId: string) {
  const db = d1(), stamp = now();
  const document = await db.prepare("SELECT * FROM fiscal_documents WHERE id=?").bind(documentId).first<Record<string, unknown>>();
  if (!document) throw new Error("XML_DOCUMENT_NOT_FOUND");
  if (document.general_entry_id && String(document.status) === "LINKED") return getFiscalDocument(documentId);
  if (document.deal_id || document.adjustment_deal_id || document.general_entry_id || document.status !== "PENDING") throw new Error("XML_ALREADY_LINKED");
  if (document.business_type !== "PURCHASE" || document.purpose !== "DEAL" || isCoffeeItems(JSON.parse(String(document.items_json || "[]")))) throw new Error("XML_EXPENSE_INVALID");
  const category = await db.prepare("SELECT id FROM financial_categories WHERE id=? AND active=1 AND type IN ('EXPENSE','BOTH')").bind(categoryId).first<{ id: string }>();
  if (!category) throw new Error("CATEGORY_NOT_FOUND");
  const parts = normalizeExpenseInstallments(JSON.parse(String(document.installments_json || "[]")), Number(document.total_amount_cents), String(document.issue_date));
  const entryIds = parts.map(() => id()), description = `NF-e ${String(document.document_number)} · ${String(document.issuer_name)}`;
  await db.batch([
    ...parts.map((part, index) => db.prepare("INSERT INTO general_entries(id,direction,description,category_id,person_id,due_date,amount_cents,paid_amount_cents,fixed_monthly,operation_key,notes,active,created_at,updated_at) VALUES(?,'PAYABLE',?,?,?,?,?,0,0,?,?,1,?,?)")
      .bind(entryIds[index], `${description} · parcela ${index + 1}/${parts.length}`, category.id, document.party_id, part.dueDate, part.amountCents, `XML-EXPENSE:${String(document.access_key)}:${index + 1}`, `Compra para uso da empresa · NF-e ${String(document.document_number)} · parcela/documento ${part.number} · chave ${String(document.access_key)}`, stamp, stamp)),
    db.prepare("UPDATE fiscal_documents SET general_entry_id=?,status='LINKED',linked_at=?,updated_at=? WHERE id=? AND status='PENDING'").bind(entryIds[0], stamp, stamp, documentId),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'FiscalDocument',?,'POST_EXPENSE',?,?)")
      .bind(id(), documentId, JSON.stringify({ categoryId, entries: entryIds, installments: parts }), stamp),
  ]);
  return getFiscalDocument(documentId);
}

export async function deleteFiscalDocument(documentId: string) {
  const db = d1(), stamp = now();
  const document = await db.prepare("SELECT * FROM fiscal_documents WHERE id=?").bind(documentId).first<Record<string, unknown>>();
  if (!document) throw new Error("XML_DOCUMENT_NOT_FOUND");
  const expenseCount = await db.prepare("SELECT COUNT(*) count FROM general_entries WHERE active=1 AND operation_key LIKE ?").bind(`XML-EXPENSE:${String(document.access_key)}:%`).first<{ count: number }>();
  if (document.deal_id || document.adjustment_deal_id || document.general_entry_id || document.funrural_general_entry_id || Number(expenseCount?.count || 0) > 0 || document.status !== "PENDING") throw new Error("XML_DELETE_LINKED");
  await db.batch([
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,before_data,created_at) VALUES(?,'FiscalDocument',?,'DELETE',?,?)")
      .bind(id(), documentId, JSON.stringify({ accessKey: document.access_key, documentNumber: document.document_number, partyId: document.party_id, totalAmountCents: document.total_amount_cents }), stamp),
    db.prepare("DELETE FROM fiscal_documents WHERE id=? AND status='PENDING'").bind(documentId),
  ]);
  try { await bucket().delete(String(document.xml_key)); } catch { /* O registro fiscal já foi removido; um arquivo órfão não afeta o financeiro. */ }
  return { ok: true, documentId };
}

export async function linkFiscalDocument(documentId: string, dealId: string) {
  const db = d1(), stamp = now();
  const [document, deal] = await Promise.all([
    db.prepare("SELECT * FROM fiscal_documents WHERE id=?").bind(documentId).first<Record<string, unknown>>(),
    db.prepare("SELECT * FROM deals WHERE id=? AND status='OPEN'").bind(dealId).first<Record<string, unknown>>(),
  ]);
  if (!document) throw new Error("XML_DOCUMENT_NOT_FOUND");
  if (!deal) throw new Error("DEAL_NOT_FOUND");
  if (document.deal_id && document.deal_id !== dealId) throw new Error("XML_ALREADY_LINKED");
  if (document.general_entry_id || (document.purpose && document.purpose !== "DEAL")) throw new Error("XML_ALREADY_LINKED");
  if (document.party_id !== deal.party_id || document.business_type !== deal.business_type) throw new Error("XML_DEAL_MISMATCH");
  const funruralEntryId = document.business_type === "PURCHASE" && Number(document.funrural_amount_cents || 0) > 0 ? await ensureFunruralMonthlyEntry(db, String(document.issue_date)) : null;
  await db.batch([
    db.prepare("UPDATE fiscal_documents SET deal_id=?,funrural_general_entry_id=?,status='LINKED',linked_at=?,updated_at=? WHERE id=?").bind(dealId, funruralEntryId, stamp, stamp, documentId),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'FiscalDocument',?,'LINK',?,?)").bind(id(), documentId, JSON.stringify({ dealId, commercialValuesPreserved: true }), stamp),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'Deal',?,'XML_LINK_CONFIRMED',?,?)").bind(id(), dealId, JSON.stringify({ documentId, commercialValuesPreserved: true }), stamp),
  ]);
  if (funruralEntryId) await recalculateFunruralEntry(db, funruralEntryId);
  return getFiscalDocument(documentId);
}

export async function unlinkFiscalDocument(documentId: string, dealId: string) {
  const db = d1(), stamp = now();
  const document = await db.prepare("SELECT id,deal_id,adjustment_deal_id,general_entry_id,funrural_general_entry_id,purpose FROM fiscal_documents WHERE id=?").bind(documentId).first<Record<string, unknown>>();
  if (!document) throw new Error("XML_DOCUMENT_NOT_FOUND");
  const ordinaryLink = document.purpose === "DEAL" && document.deal_id === dealId;
  const returnLink = document.purpose === "SALE_RETURN" && document.adjustment_deal_id === dealId;
  if (!ordinaryLink && !returnLink) throw new Error("XML_LINK_NOT_FOUND");
  if (returnLink && document.general_entry_id) throw new Error("XML_RETURN_HAS_FINANCIAL_ENTRY");
  const funruralEntryId = ordinaryLink && document.funrural_general_entry_id ? String(document.funrural_general_entry_id) : null;
  await db.batch([
    ordinaryLink
      ? db.prepare("UPDATE fiscal_documents SET deal_id=NULL,funrural_general_entry_id=NULL,status='PENDING',linked_at=NULL,updated_at=? WHERE id=? AND deal_id=?").bind(stamp,documentId,dealId)
      : db.prepare("UPDATE fiscal_documents SET adjustment_deal_id=NULL,status='PENDING',linked_at=NULL,updated_at=? WHERE id=? AND adjustment_deal_id=?").bind(stamp,documentId,dealId),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,before_data,after_data,created_at) VALUES(?,'FiscalDocument',?,'UNLINK',?,?,?)").bind(id(),documentId,JSON.stringify({dealId,purpose:document.purpose}),JSON.stringify({status:"PENDING"}),stamp),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'Deal',?,'XML_UNLINK',?,?)").bind(id(),dealId,JSON.stringify({documentId}),stamp),
  ]);
  if (funruralEntryId) await recalculateFunruralEntry(db, funruralEntryId);
  return { ok: true, documentId, dealId };
}

export async function registerSaleReturn(documentId: string, dealId: string, financialTreatment: "FISCAL_ONLY" | "REFUND_PAYABLE", dueDate?: string, notes?: string) {
  const db = d1(), stamp = now();
  const document = await db.prepare("SELECT * FROM fiscal_documents WHERE id=?").bind(documentId).first<Record<string, unknown>>();
  if (!document) throw new Error("XML_DOCUMENT_NOT_FOUND");
  if (document.deal_id || document.adjustment_deal_id || document.general_entry_id) throw new Error("XML_ALREADY_LINKED");
  if (document.purpose !== "SALE_RETURN") throw new Error("XML_DEAL_MISMATCH");
  const deal = await db.prepare("SELECT * FROM deals WHERE id=? AND business_type='SALE' AND status='OPEN'").bind(dealId).first<Record<string, unknown>>();
  if (!deal) throw new Error("DEAL_NOT_FOUND");
  if (deal.party_id !== document.party_id) throw new Error("RETURN_DEAL_MISMATCH");
  const totals = await db.prepare("SELECT (SELECT COALESCE(SUM(total_amount_cents),0) FROM fiscal_documents WHERE deal_id=? AND status='LINKED' AND purpose='DEAL') fiscal_total,(SELECT COALESCE(SUM(estimated_kilograms_milli),0) FROM fiscal_documents WHERE deal_id=? AND status='LINKED' AND purpose='DEAL') fiscal_kg,(SELECT COALESCE(SUM(total_amount_cents),0) FROM fiscal_documents WHERE adjustment_deal_id=? AND status='LINKED' AND purpose='SALE_RETURN') return_total,(SELECT COALESCE(SUM(estimated_kilograms_milli),0) FROM fiscal_documents WHERE adjustment_deal_id=? AND status='LINKED' AND purpose='SALE_RETURN') return_kg").bind(dealId,dealId,dealId,dealId).first<{fiscal_total:number;fiscal_kg:number;return_total:number;return_kg:number}>();
  const before = calculateFiscalAdjustment({ fiscalTotalCents:Number(totals?.fiscal_total||0), commercialTotalCents:Number(deal.total_amount_cents), returnTotalCents:Number(totals?.return_total||0), fiscalKilogramsMilli:Number(totals?.fiscal_kg||0), receivedKilogramsMilli:Number(deal.received_kilograms_milli??deal.kilograms_milli), returnKilogramsMilli:Number(totals?.return_kg||0) });
  if (before.openDifferenceCents <= 0 && before.openKilogramsMilli <= 0) throw new Error("FISCAL_DIFFERENCE_NOT_FOUND");
  if (Number(document.total_amount_cents) > before.openDifferenceCents + 1) throw new Error("RETURN_EXCEEDS_FISCAL_DIFFERENCE");
  if (financialTreatment === "REFUND_PAYABLE" && !dueDate) throw new Error("RETURN_DUE_DATE_REQUIRED");
  let entryId: string | null = null;
  if (financialTreatment === "REFUND_PAYABLE") {
  let category = await db.prepare("SELECT id FROM financial_categories WHERE code='DEVOLUCAO_VENDA' LIMIT 1").first<{ id: string }>();
  if (!category) {
    const categoryId = id();
    await db.prepare("INSERT OR IGNORE INTO financial_categories(id,code,name,type,description,active,created_at,updated_at) VALUES(?,'DEVOLUCAO_VENDA','Devolução de venda','EXPENSE','Recebimento a maior, quebra de peso e devoluções comerciais',1,?,?)").bind(categoryId, stamp, stamp).run();
    category = await db.prepare("SELECT id FROM financial_categories WHERE code='DEVOLUCAO_VENDA' LIMIT 1").first<{ id: string }>();
  }
  if (!category) throw new Error("CATEGORY_NOT_FOUND");
  entryId = id(); const description = `Devolução de venda #${String(deal.sequence).padStart(5,"0")} · NF-e ${String(document.document_number)}`;
  await db.batch([
    db.prepare("INSERT INTO general_entries(id,direction,description,category_id,person_id,due_date,amount_cents,paid_amount_cents,fixed_monthly,operation_key,notes,active,created_at,updated_at) VALUES(?,'PAYABLE',?,?,?,?,?,0,0,?,?,1,?,?)")
      .bind(entryId, description, category.id, document.party_id, dueDate, document.total_amount_cents, `XML-RETURN:${String(document.access_key)}`, notes || `Devolução por recebimento a maior / quebra de peso. NF-e ${String(document.document_number)} · Negócio #${String(deal.sequence).padStart(5,"0")}`, stamp, stamp),
    db.prepare("UPDATE fiscal_documents SET purpose='SALE_RETURN',adjustment_deal_id=?,general_entry_id=?,status='LINKED',linked_at=?,updated_at=? WHERE id=?").bind(dealId, entryId, stamp, stamp, documentId),
    db.prepare("INSERT OR IGNORE INTO person_roles(person_id,role) VALUES(?,'CUSTOMER')").bind(document.party_id),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'FiscalDocument',?,'REGISTER_SALE_RETURN',?,?)").bind(id(), documentId, JSON.stringify({ dealId, financialTreatment, generalEntryId: entryId, dueDate, amount: money(Number(document.total_amount_cents)), openBefore: money(before.openDifferenceCents) }), stamp),
  ]);
  } else await db.batch([
    db.prepare("UPDATE fiscal_documents SET purpose='SALE_RETURN',adjustment_deal_id=?,general_entry_id=NULL,status='LINKED',linked_at=?,updated_at=? WHERE id=?").bind(dealId, stamp, stamp, documentId),
    db.prepare("INSERT OR IGNORE INTO person_roles(person_id,role) VALUES(?,'CUSTOMER')").bind(document.party_id),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'FiscalDocument',?,'REGISTER_SALE_RETURN',?,?)").bind(id(), documentId, JSON.stringify({ dealId, financialTreatment, amount: money(Number(document.total_amount_cents)), openBefore: money(before.openDifferenceCents) }), stamp),
  ]);
  return getFiscalDocument(documentId);
}

export async function fiscalXmlObject(documentId: string) {
  const row = await d1().prepare("SELECT xml_key,original_filename FROM fiscal_documents WHERE id=?").bind(documentId).first<{ xml_key: string; original_filename: string | null }>();
  if (!row) throw new Error("XML_DOCUMENT_NOT_FOUND");
  const object = await bucket().get(row.xml_key);
  if (!object) throw new Error("XML_FILE_NOT_FOUND");
  return { object, filename: row.original_filename || `${documentId}.xml` };
}

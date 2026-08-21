import { extractText } from "unpdf";
import { cents, d1, id, money, now, optional } from "@/lib/d1";
import { parseImportedPdfText } from "@/lib/pdf-document-parser";

function bucket(){const value=(globalThis as typeof globalThis&{__SISTEMA_CAFE_BUCKET?:R2Bucket}).__SISTEMA_CAFE_BUCKET;if(!value)throw new Error("PDF_STORAGE_UNAVAILABLE");return value}
const record=(row:Record<string,unknown>)=>({id:row.id,documentType:row.document_type,originalFilename:row.original_filename,issuerName:row.issuer_name,issuerDocument:row.issuer_document,competence:row.competence,dueDate:row.due_date,documentNumber:row.document_number,amount:row.amount_cents==null?null:money(Number(row.amount_cents)),paymentCode:row.payment_code,status:row.status,generalEntryId:row.general_entry_id,details:JSON.parse(String(row.details_json||"{}")),createdAt:row.created_at});

export async function importPdfDocument(file:File){
  if(file.size>10*1024*1024)throw new Error("PDF_TOO_LARGE");const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("PDF_INVALID");
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(value=>value.toString(16).padStart(2,"0")).join("");
  const db=d1(),duplicate=await db.prepare("SELECT * FROM imported_documents WHERE fingerprint=?").bind(hash).first<Record<string,unknown>>();if(duplicate)return{document:record(duplicate),duplicate:true};
  const extracted=await extractText(bytes,{mergePages:true}),parsed=parseImportedPdfText(extracted.text);if(parsed.ignored)throw new Error("PDF_RECEIPT_IGNORED");
  const documentId=id(),stamp=now(),pdfKey=`documents/${stamp.slice(0,7)}/${hash}.pdf`;
  await bucket().put(pdfKey,bytes,{httpMetadata:{contentType:"application/pdf"},customMetadata:{originalName:file.name.slice(0,160),fingerprint:hash}});
  await db.batch([
    db.prepare("INSERT INTO imported_documents(id,fingerprint,document_type,original_filename,pdf_key,issuer_name,issuer_document,competence,due_date,document_number,amount_cents,payment_code,details_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'REVIEW',?,?)").bind(documentId,hash,parsed.documentType,file.name.slice(0,160),pdfKey,parsed.issuerName,parsed.issuerDocument,parsed.competence,parsed.dueDate,parsed.documentNumber,parsed.amountCents,parsed.paymentCode,JSON.stringify(parsed.details),stamp,stamp),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'ImportedDocument',?,'IMPORT',?,?)").bind(id(),documentId,JSON.stringify({type:parsed.documentType,filename:file.name}),stamp),
  ]);
  const row=await db.prepare("SELECT * FROM imported_documents WHERE id=?").bind(documentId).first<Record<string,unknown>>();return{document:record(row!),duplicate:false};
}

export async function importedDocumentOptions(){const db=d1();const[categories,people]=await Promise.all([db.prepare("SELECT id,name,type FROM financial_categories WHERE active=1 ORDER BY name").all(),db.prepare("SELECT id,legal_name legalName FROM people WHERE active=1 ORDER BY legal_name").all()]);return{categories:categories.results,people:people.results}}
export async function listImportedDocuments(){const rows=await d1().prepare("SELECT * FROM imported_documents ORDER BY created_at DESC").all();return rows.results.map(record)}

async function defaultCategory(db:ReturnType<typeof d1>,type:string,stamp:string){const code=type==="FGTS"?"ENCARGOS_FGTS":"TRIBUTOS_DARF",name=type==="FGTS"?"FGTS":"DARF e tributos federais";let row=await db.prepare("SELECT id FROM financial_categories WHERE code=? AND active=1").bind(code).first<{id:string}>();if(!row){const categoryId=id();await db.prepare("INSERT OR IGNORE INTO financial_categories(id,code,name,type,description,active,created_at,updated_at) VALUES(?,?,?,'EXPENSE','Guia importada em PDF',1,?,?)").bind(categoryId,code,name,stamp,stamp).run();row=await db.prepare("SELECT id FROM financial_categories WHERE code=? AND active=1").bind(code).first<{id:string}>()}return row?.id??null}

export async function postImportedDocument(documentId:string,input:unknown){
  const data=input as Record<string,unknown>,db=d1(),row=await db.prepare("SELECT * FROM imported_documents WHERE id=?").bind(documentId).first<Record<string,unknown>>();if(!row)throw new Error("PDF_DOCUMENT_NOT_FOUND");if(row.status==="POSTED")return record(row);
  const type=String(data.documentType||row.document_type),description=String(data.description||"").trim(),dueDate=String(data.dueDate||""),amount=String(data.amount||"");if(!description||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!amount)throw new Error("PDF_REVIEW_REQUIRED");
  const stamp=now(),categoryId=String(data.categoryId||"")||await defaultCategory(db,type,stamp);if(!categoryId)throw new Error("CATEGORY_NOT_FOUND");
  const category=await db.prepare("SELECT id FROM financial_categories WHERE id=? AND active=1").bind(categoryId).first();if(!category)throw new Error("CATEGORY_NOT_FOUND");
  const entryId=id(),amountCents=cents(amount),documentNumber=optional(data.documentNumber),competence=optional(data.competence),issuerName=optional(data.issuerName),notes=[`Documento PDF: ${String(row.original_filename)}`,documentNumber?`Número: ${documentNumber}`:null,competence?`Competência: ${competence}`:null].filter(Boolean).join(" · ");
  await db.batch([
    db.prepare("INSERT INTO general_entries(id,direction,description,category_id,person_id,due_date,amount_cents,paid_amount_cents,fixed_monthly,operation_key,notes,active,created_at,updated_at) VALUES(?,'PAYABLE',?,?,?,?,?,0,0,?,?,1,?,?)").bind(entryId,description,categoryId,optional(data.personId),dueDate,amountCents,`PDF:${String(row.fingerprint)}`,notes,stamp,stamp),
    db.prepare("UPDATE imported_documents SET document_type=?,issuer_name=?,competence=?,due_date=?,document_number=?,amount_cents=?,status='POSTED',general_entry_id=?,updated_at=? WHERE id=?").bind(type,issuerName,competence,dueDate,documentNumber,amountCents,entryId,stamp,documentId),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'ImportedDocument',?,'POST',?,?)").bind(id(),documentId,JSON.stringify({entryId,amount:money(amountCents),dueDate}),stamp),
  ]);const updated=await db.prepare("SELECT * FROM imported_documents WHERE id=?").bind(documentId).first<Record<string,unknown>>();return record(updated!)}

export async function importedPdfObject(documentId:string){const row=await d1().prepare("SELECT pdf_key,original_filename FROM imported_documents WHERE id=?").bind(documentId).first<{pdf_key:string;original_filename:string}>();if(!row)throw new Error("PDF_DOCUMENT_NOT_FOUND");const object=await bucket().get(row.pdf_key);if(!object)throw new Error("PDF_FILE_NOT_FOUND");return{object,filename:row.original_filename}}

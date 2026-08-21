import { d1,id,now,cents,money,decimal,kilogramsMilli,kilograms,optional } from "@/lib/d1";
import { brokerCommissionPaymentSchema, purchaseSchema } from "@/lib/validation";
import { calculateCoffeeTotals, normalizeOptionalFilter, normalizeReportDirection } from "@/lib/financial-rules";
import { calculateFiscalAdjustment } from "@/lib/fiscal-aggregation";
import { ensureFunruralMonthlyEntry, recalculateFunruralEntry } from "@/lib/funrural";

export async function purchaseOptions(){const db=d1();const[s,c,p,b,a]=await Promise.all([db.prepare("SELECT p.id,p.legal_name legalName FROM people p JOIN person_roles r ON r.person_id=p.id WHERE p.active=1 AND r.role='SUPPLIER' ORDER BY p.legal_name").all(),db.prepare("SELECT p.id,p.legal_name legalName FROM people p JOIN person_roles r ON r.person_id=p.id WHERE p.active=1 AND r.role='CUSTOMER' ORDER BY p.legal_name").all(),db.prepare("SELECT id,legal_name name FROM people WHERE active=1 ORDER BY legal_name").all(),db.prepare("SELECT id,name FROM brokers WHERE active=1 ORDER BY name").all(),db.prepare("SELECT id,bank_name bankName,account_number accountNumber FROM bank_accounts WHERE active=1 ORDER BY bank_name,account_number").all()]);const brokerMap=new Map<string,unknown>();for(const row of [...p.results,...b.results])brokerMap.set(String(row.id),row);return{suppliers:s.results,clients:c.results,brokers:[...brokerMap.values()],accounts:a.results}}

async function resolveBrokerId(db:ReturnType<typeof d1>, selectedId:string|undefined){
  if(!selectedId)return null;
  const existing=await db.prepare("SELECT id FROM brokers WHERE id=? AND active=1").bind(selectedId).first<{id:string}>();
  if(existing)return existing.id;
  const person=await db.prepare("SELECT * FROM people WHERE id=? AND active=1").bind(selectedId).first<Record<string,unknown>>();
  if(!person)throw new Error("BROKER_NOT_FOUND");
  const matchingDocument=person.cpf_cnpj?await db.prepare("SELECT id FROM brokers WHERE cpf_cnpj=? AND active=1").bind(person.cpf_cnpj).first<{id:string}>():null;
  const stamp=now();
  const statements=[db.prepare("INSERT OR IGNORE INTO person_roles(person_id,role) VALUES(?,'BROKER')").bind(selectedId)];
  if(!matchingDocument)statements.push(db.prepare("INSERT INTO brokers(id,person_type,name,trade_name,cpf_cnpj,rg_ie,email,phone,pix_key,notes,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,NULL,?,1,?,?)").bind(selectedId,person.person_type,person.legal_name,person.trade_name,person.cpf_cnpj,person.rg_ie,person.email,person.phone,person.notes,stamp,stamp));
  await db.batch(statements);
  if(matchingDocument)return matchingDocument.id;
  return selectedId;
}

type ParsedPurchase=ReturnType<typeof purchaseSchema.parse>;
type BrokerInput={brokerId:string;commissionMode:"PERCENT"|"AMOUNT";commissionValue:string};
type ResolvedBroker=BrokerInput&{brokerId:string;commissionAmount:number};

function requestedBrokers(data:ParsedPurchase):BrokerInput[]{
  const rows=data.brokers?.length?data.brokers:(data.brokerId?[{brokerId:data.brokerId,commissionMode:data.commissionMode,commissionValue:data.commissionValue}]:[]);
  const seen=new Set<string>();
  return rows.filter(row=>{if(seen.has(row.brokerId))throw new Error("DUPLICATE_BROKER");seen.add(row.brokerId);return true});
}

function commissionCents(total:number,row:BrokerInput){return row.commissionMode==="PERCENT"?Math.round(total*decimal(row.commissionValue)/100):cents(row.commissionValue)}

async function resolveBrokers(db:ReturnType<typeof d1>,data:ParsedPurchase,total:number){
  const rows:ResolvedBroker[]=[];
  for(const row of requestedBrokers(data)){const brokerId=await resolveBrokerId(db,row.brokerId);if(!brokerId)continue;rows.push({...row,brokerId,commissionAmount:commissionCents(total,row)})}
  if(new Set(rows.map(row=>row.brokerId)).size!==rows.length)throw new Error("DUPLICATE_BROKER");
  return rows;
}

async function dealRelations(db:ReturnType<typeof d1>,dealId:string){
  return (await dealRelationsBatch(db,[dealId])).get(dealId)!;
}

type DealRelations={parts:Record<string,unknown>[];brokers:Record<string,unknown>[];fiscal:Record<string,unknown>;fiscalDocuments:Record<string,unknown>[]};

async function dealRelationsBatch(db:ReturnType<typeof d1>,dealIds:string[]){
  const result=new Map<string,DealRelations>();
  for(const dealId of dealIds)result.set(dealId,{parts:[],brokers:[],fiscal:{document_count:0,fiscal_total:0,fiscal_kg:0,return_count:0,return_total:0,return_kg:0},fiscalDocuments:[]});
  if(!dealIds.length)return result;
  const marks=dealIds.map(()=>"?").join(",");
  const [parts,brokers,documents]=await Promise.all([
    db.prepare(`SELECT * FROM installments WHERE deal_id IN (${marks}) ORDER BY deal_id,number`).bind(...dealIds).all(),
    db.prepare(`SELECT db.*,b.name broker_name FROM deal_brokers db JOIN brokers b ON b.id=db.broker_id WHERE db.deal_id IN (${marks}) ORDER BY db.deal_id,db.position`).bind(...dealIds).all(),
    db.prepare(`SELECT id,deal_id,adjustment_deal_id,document_number,series,access_key,issue_date,total_amount_cents,estimated_kilograms_milli,purpose,original_filename FROM fiscal_documents WHERE status='LINKED' AND ((deal_id IN (${marks}) AND purpose='DEAL') OR (adjustment_deal_id IN (${marks}) AND purpose='SALE_RETURN')) ORDER BY purpose,issue_date,document_number`).bind(...dealIds,...dealIds).all(),
  ]);
  for(const row of parts.results)result.get(String(row.deal_id))?.parts.push(row);
  for(const row of brokers.results)result.get(String(row.deal_id))?.brokers.push(row);
  for(const row of documents.results){
    const isReturn=row.purpose==="SALE_RETURN",dealId=String(isReturn?row.adjustment_deal_id:row.deal_id),related=result.get(dealId);if(!related)continue;
    related.fiscalDocuments.push(row);
    if(isReturn){related.fiscal.return_count=Number(related.fiscal.return_count)+1;related.fiscal.return_total=Number(related.fiscal.return_total)+Number(row.total_amount_cents);related.fiscal.return_kg=Number(related.fiscal.return_kg)+Number(row.estimated_kilograms_milli||0)}
    else{related.fiscal.document_count=Number(related.fiscal.document_count)+1;related.fiscal.fiscal_total=Number(related.fiscal.fiscal_total)+Number(row.total_amount_cents);related.fiscal.fiscal_kg=Number(related.fiscal.fiscal_kg)+Number(row.estimated_kilograms_milli||0)}
  }
  return result;
}

function deal(row:Record<string,unknown>,parts:Record<string,unknown>[]=[],brokerRows:Record<string,unknown>[]=[],fiscalRow:Record<string,unknown>={},fiscalDocumentRows:Record<string,unknown>[]=[]){
  const effective=Number(row.kilograms_milli),contracted=Number(row.contracted_kilograms_milli??effective),received=row.received_kilograms_milli==null?null:Number(row.received_kilograms_milli);
  const brokers=brokerRows.map(item=>({id:item.broker_id,name:item.broker_name,commissionMode:item.commission_mode,commissionValue:item.commission_value,commissionAmount:money(Number(item.commission_amount_cents))}));
  const first=brokers[0]??(row.broker_id?{id:row.broker_id,name:row.broker_name,commissionMode:row.commission_mode??"AMOUNT",commissionValue:row.commission_value??money(Number(row.commission_amount_cents)),commissionAmount:money(Number(row.commission_amount_cents))}:null);
  const totalCommission=brokerRows.length?brokerRows.reduce((sum,item)=>sum+Number(item.commission_amount_cents),0):Number(row.commission_amount_cents);
  const adjustment=calculateFiscalAdjustment({fiscalTotalCents:Number(fiscalRow.fiscal_total||0),commercialTotalCents:Number(row.total_amount_cents),returnTotalCents:Number(fiscalRow.return_total||0),fiscalKilogramsMilli:Number(fiscalRow.fiscal_kg||0),receivedKilogramsMilli:received??effective,returnKilogramsMilli:Number(fiscalRow.return_kg||0)});
  return{id:row.id,sequence:row.sequence,businessType:row.business_type,date:row.date,kilograms:kilograms(effective),contractedKilograms:kilograms(contracted),receivedKilograms:received==null?null:kilograms(received),weightStatus:received==null?"PENDING":"CONFIRMED",sacks:(effective/60000).toFixed(3),pricePerSack:money(Number(row.price_per_sack_cents)),grossAmount:money(Number(row.gross_amount_cents)),adjustmentAmount:money(Number(row.adjustment_amount_cents)),totalAmount:money(Number(row.total_amount_cents)),commissionMode:first?.commissionMode??"AMOUNT",commissionValue:first?.commissionValue??"0",commissionAmount:money(totalCommission),notes:row.notes,status:row.status,supplier:{id:row.party_id,legalName:row.legal_name},broker:first?{id:first.id,name:first.name}:null,brokers,fiscal:{documentCount:Number(fiscalRow.document_count||0),returnDocumentCount:Number(fiscalRow.return_count||0),fiscalTotal:money(Number(fiscalRow.fiscal_total||0)),returnTotal:money(Number(fiscalRow.return_total||0)),openDifference:money(adjustment.openDifferenceCents),openKilograms:kilograms(adjustment.openKilogramsMilli),status:adjustment.status},fiscalDocuments:fiscalDocumentRows.map(document=>({id:String(document.id),documentNumber:String(document.document_number),series:document.series?String(document.series):null,accessKey:String(document.access_key),issueDate:String(document.issue_date),totalAmount:money(Number(document.total_amount_cents)),kilograms:document.estimated_kilograms_milli==null?null:kilograms(Number(document.estimated_kilograms_milli)),sacks:document.estimated_kilograms_milli==null?null:(Number(document.estimated_kilograms_milli)/60000).toFixed(3),purpose:document.purpose,originalFilename:document.original_filename||null})),installments:parts.map(p=>({id:p.id,number:p.number,dueDate:p.due_date,amount:money(Number(p.amount_cents)),paidAmount:money(Number(p.paid_amount_cents))}))}
}

export async function listPurchases(search=""){const db=d1(),q=`%${search}%`;const rows=await db.prepare("SELECT d.*,p.legal_name,b.name broker_name FROM deals d JOIN people p ON p.id=d.party_id LEFT JOIN brokers b ON b.id=d.broker_id WHERE d.status='OPEN' AND (p.legal_name LIKE ? OR EXISTS(SELECT 1 FROM deal_brokers db JOIN brokers bx ON bx.id=db.broker_id WHERE db.deal_id=d.id AND bx.name LIKE ?)) ORDER BY d.date DESC,d.sequence DESC").bind(q,q).all(),relations=await dealRelationsBatch(db,rows.results.map(row=>String(row.id)));return rows.results.map(row=>{const related=relations.get(String(row.id))!;return deal(row,related.parts,related.brokers,related.fiscal,related.fiscalDocuments)})}

export async function purchasePage(search="",financialStatus="OPEN",page=1,pageSize=50){
  const db=d1(),q=`%${search}%`,safeStatus=["ALL","OPEN","SETTLED"].includes(financialStatus)?financialStatus:"OPEN",safePage=Math.max(1,Math.trunc(page)||1),limit=Math.min(100,Math.max(10,Math.trunc(pageSize)||50));
  const searchSql="(p.legal_name LIKE ? OR p.trade_name LIKE ? OR CAST(d.sequence AS TEXT) LIKE ? OR EXISTS(SELECT 1 FROM deal_brokers db JOIN brokers bx ON bx.id=db.broker_id WHERE db.deal_id=d.id AND bx.name LIKE ?))";
  const statusSql=safeStatus==="OPEN"?"AND EXISTS(SELECT 1 FROM installments i WHERE i.deal_id=d.id AND i.amount_cents>i.paid_amount_cents)":safeStatus==="SETTLED"?"AND NOT EXISTS(SELECT 1 FROM installments i WHERE i.deal_id=d.id AND i.amount_cents>i.paid_amount_cents)":"";
  const [countRow,summary]=await Promise.all([
    db.prepare(`SELECT COUNT(*) total FROM deals d JOIN people p ON p.id=d.party_id WHERE d.status='OPEN' AND ${searchSql} ${statusSql}`).bind(q,q,q,q).first<{total:number}>(),
    db.prepare("SELECT COUNT(*) total,SUM(CASE WHEN business_type='PURCHASE' THEN 1 ELSE 0 END) purchases,SUM(CASE WHEN business_type='SALE' THEN 1 ELSE 0 END) sales,SUM(CASE WHEN EXISTS(SELECT 1 FROM installments i WHERE i.deal_id=d.id AND i.amount_cents>i.paid_amount_cents) THEN 1 ELSE 0 END) open_count,SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM installments i WHERE i.deal_id=d.id AND i.amount_cents>i.paid_amount_cents) THEN 1 ELSE 0 END) settled_count FROM deals d WHERE d.status='OPEN'").first<Record<string,unknown>>(),
  ]);
  const total=Number(countRow?.total||0),pages=Math.max(1,Math.ceil(total/limit)),currentPage=Math.min(safePage,pages),offset=(currentPage-1)*limit;
  const rows=await db.prepare(`SELECT d.*,p.legal_name,b.name broker_name FROM deals d JOIN people p ON p.id=d.party_id LEFT JOIN brokers b ON b.id=d.broker_id WHERE d.status='OPEN' AND ${searchSql} ${statusSql} ORDER BY d.date DESC,d.sequence DESC LIMIT ? OFFSET ?`).bind(q,q,q,q,limit,offset).all();
  const relations=await dealRelationsBatch(db,rows.results.map(row=>String(row.id)));
  const items=rows.results.map(row=>{const related=relations.get(String(row.id))!;return deal(row,related.parts,related.brokers,related.fiscal,related.fiscalDocuments)});
  return{items,pagination:{page:currentPage,pageSize:limit,total,pages},summary:{purchases:Number(summary?.purchases||0),sales:Number(summary?.sales||0),total:Number(summary?.total||0),open:Number(summary?.open_count||0),settled:Number(summary?.settled_count||0)}};
}

export async function getPurchase(dealId:string){const db=d1();const row=await db.prepare("SELECT d.*,p.legal_name,b.name broker_name FROM deals d JOIN people p ON p.id=d.party_id LEFT JOIN brokers b ON b.id=d.broker_id WHERE d.id=? AND d.status='OPEN'").bind(dealId).first<Record<string,unknown>>();if(!row)throw new Error("DEAL_NOT_FOUND");const related=await dealRelations(db,dealId);return deal(row,related.parts,related.brokers,related.fiscal,related.fiscalDocuments)}

function purchaseAmounts(data:ParsedPurchase){
  const contractedKg=decimal(data.kilograms),receivedKg=data.receivedKilograms?decimal(data.receivedKilograms):null,effectiveKg=receivedKg??contractedKg,price=decimal(data.pricePerSack),adjust=cents(data.adjustmentAmount),totals=calculateCoffeeTotals(effectiveKg,price,adjust,"AMOUNT",0,false);
  return{contractedKg,receivedKg,effectiveKg,gross:totals.grossCents,adjust,total:totals.totalCents};
}

export async function createPurchase(input:unknown){
  const data=purchaseSchema.parse(input),db=d1(),dealId=id(),stamp=now(),amounts=purchaseAmounts(data);
  const existing=await db.prepare("SELECT id FROM deals WHERE operation_key=?").bind(data.operationKey).first<{id:string}>();
  if(existing){const row=await db.prepare("SELECT d.*,p.legal_name,b.name broker_name FROM deals d JOIN people p ON p.id=d.party_id LEFT JOIN brokers b ON b.id=d.broker_id WHERE d.id=?").bind(existing.id).first<Record<string,unknown>>(),related=await dealRelations(db,existing.id);return deal(row!,related.parts,related.brokers,related.fiscal)}
  const partTotal=data.installments.reduce((sum,x)=>sum+cents(x.amount),0);if(partTotal!==amounts.total)throw new Error("INSTALLMENT_TOTAL");
  const fiscalDocument=data.xmlDocumentId?await db.prepare("SELECT id,party_id,business_type,deal_id,issue_date,funrural_amount_cents FROM fiscal_documents WHERE id=?").bind(data.xmlDocumentId).first<{id:string;party_id:string;business_type:string;deal_id:string|null;issue_date:string;funrural_amount_cents:number|null}>():null;
  if(data.xmlDocumentId&&!fiscalDocument)throw new Error("XML_DOCUMENT_NOT_FOUND");
  if(fiscalDocument?.deal_id)throw new Error("XML_ALREADY_LINKED");
  if(fiscalDocument&&(fiscalDocument.party_id!==data.supplierId||fiscalDocument.business_type!==data.businessType))throw new Error("XML_DEAL_MISMATCH");
  const brokerRows=await resolveBrokers(db,data,amounts.total),firstBroker=brokerRows[0]??null,totalCommission=brokerRows.reduce((sum,row)=>sum+row.commissionAmount,0);
  const funruralEntryId=fiscalDocument&&data.businessType==="PURCHASE"&&Number(fiscalDocument.funrural_amount_cents||0)>0?await ensureFunruralMonthlyEntry(db,fiscalDocument.issue_date):null;
  const last=await db.prepare("SELECT COALESCE(MAX(sequence),0) sequence FROM deals").first<{sequence:number}>(),sequence=(last?.sequence??0)+1;
  await db.batch([
    db.prepare("INSERT INTO deals(id,sequence,business_type,date,party_id,kilograms_milli,contracted_kilograms_milli,received_kilograms_milli,price_per_sack_cents,gross_amount_cents,adjustment_amount_cents,total_amount_cents,broker_id,commission_amount_cents,commission_mode,commission_value,operation_key,notes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'OPEN',?,?)").bind(dealId,sequence,data.businessType,data.date,data.supplierId,kilogramsMilli(amounts.effectiveKg),kilogramsMilli(amounts.contractedKg),amounts.receivedKg==null?null:kilogramsMilli(amounts.receivedKg),cents(data.pricePerSack),amounts.gross,amounts.adjust,amounts.total,firstBroker?.brokerId??null,totalCommission,firstBroker?.commissionMode??"AMOUNT",firstBroker?.commissionValue??"0",data.operationKey,optional(data.notes),stamp,stamp),
    ...brokerRows.map((row,index)=>db.prepare("INSERT INTO deal_brokers(id,deal_id,broker_id,position,commission_mode,commission_value,commission_amount_cents,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id(),dealId,row.brokerId,index+1,row.commissionMode,row.commissionValue,row.commissionAmount,stamp,stamp)),
    ...data.installments.map((part,index)=>db.prepare("INSERT INTO installments(id,deal_id,number,due_date,amount_cents,paid_amount_cents,created_at,updated_at) VALUES(?,?,?,?,?,0,?,?)").bind(id(),dealId,index+1,part.dueDate,cents(part.amount),stamp,stamp)),
    ...(fiscalDocument?[db.prepare("UPDATE fiscal_documents SET deal_id=?,funrural_general_entry_id=?,status='LINKED',linked_at=?,updated_at=? WHERE id=?").bind(dealId,funruralEntryId,stamp,stamp,fiscalDocument.id)]:[]),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'Deal',?,'CREATE',?,?)").bind(id(),dealId,JSON.stringify({sequence,contractedKilograms:data.kilograms,receivedKilograms:data.receivedKilograms??null,total:money(amounts.total),brokers:brokerRows.length}),stamp),
    ...(fiscalDocument?[db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'FiscalDocument',?,'LINK',?,?)").bind(id(),fiscalDocument.id,JSON.stringify({dealId}),stamp)]:[]),
  ]);
  if(funruralEntryId)await recalculateFunruralEntry(db,funruralEntryId);
  const row=await db.prepare("SELECT d.*,p.legal_name,b.name broker_name FROM deals d JOIN people p ON p.id=d.party_id LEFT JOIN brokers b ON b.id=d.broker_id WHERE d.id=?").bind(dealId).first<Record<string,unknown>>(),related=await dealRelations(db,dealId);return deal(row!,related.parts,related.brokers,related.fiscal)
}

export async function updatePurchase(dealId:string,input:unknown){
  const data=purchaseSchema.parse(input),db=d1(),amounts=purchaseAmounts(data),stamp=now();
  const old=await db.prepare("SELECT d.*,p.legal_name,b.name broker_name FROM deals d JOIN people p ON p.id=d.party_id LEFT JOIN brokers b ON b.id=d.broker_id WHERE d.id=? AND d.status='OPEN'").bind(dealId).first<Record<string,unknown>>();
  if(!old)throw new Error("DEAL_NOT_FOUND");
  const oldRelated=await dealRelations(db,dealId),oldParts=oldRelated.parts;
  const hasSettlement=await db.prepare("SELECT 1 found FROM settlements s JOIN installments i ON i.id=s.origin_id WHERE s.origin_type='INSTALLMENT' AND i.deal_id=? LIMIT 1").bind(dealId).first();
  if(hasSettlement&&data.businessType!==old.business_type)throw new Error("BUSINESS_TYPE_LOCKED");
  const partTotal=data.installments.reduce((sum,x)=>sum+cents(x.amount),0);if(partTotal!==amounts.total)throw new Error("INSTALLMENT_TOTAL");
  const oldById=new Map(oldParts.map(part=>[String(part.id),part])),incomingIds=new Set<string>();
  for(const part of data.installments){if(!part.id)continue;if(incomingIds.has(part.id)||!oldById.has(part.id))throw new Error("INSTALLMENT_NOT_FOUND");incomingIds.add(part.id);if(cents(part.amount)<Number(oldById.get(part.id)!.paid_amount_cents))throw new Error("INSTALLMENT_BELOW_PAID")}
  for(const part of oldParts)if(!incomingIds.has(String(part.id))&&Number(part.paid_amount_cents)>0)throw new Error("PAID_INSTALLMENT_REMOVE");
  const brokerRows=await resolveBrokers(db,data,amounts.total),firstBroker=brokerRows[0]??null,totalCommission=brokerRows.reduce((sum,row)=>sum+row.commissionAmount,0);
  const incomingCommission=new Map(brokerRows.map(row=>[row.brokerId,row.commissionAmount]));
  const affectedBrokers=new Set([...oldRelated.brokers.map(row=>String(row.broker_id)),...brokerRows.map(row=>row.brokerId)]);
  for(const affectedBrokerId of affectedBrokers){
    const credits=await db.prepare("SELECT COALESCE(SUM(db.commission_amount_cents),0) total FROM deal_brokers db JOIN deals d ON d.id=db.deal_id WHERE db.broker_id=? AND d.status='OPEN' AND d.id<>?").bind(affectedBrokerId,dealId).first<{total:number}>(),payments=await db.prepare("SELECT COALESCE(SUM(cp.amount_cents),0) total FROM broker_commission_payments cp JOIN bank_transactions bt ON bt.id=cp.bank_transaction_id WHERE cp.broker_id=? AND bt.active=1 AND bt.status<>'CANCELLED'").bind(affectedBrokerId).first<{total:number}>();
    const projected=Number(credits?.total??0)+(incomingCommission.get(affectedBrokerId)??0);if(projected<Number(payments?.total??0))throw new Error("BROKER_BALANCE_CONFLICT");
  }
  const party=await db.prepare("SELECT legal_name FROM people WHERE id=? AND active=1").bind(data.supplierId).first<{legal_name:string}>();if(!party)throw new Error("ORIGIN_NOT_FOUND");
  const statements=[
    db.prepare("UPDATE deals SET business_type=?,date=?,party_id=?,kilograms_milli=?,contracted_kilograms_milli=?,received_kilograms_milli=?,price_per_sack_cents=?,gross_amount_cents=?,adjustment_amount_cents=?,total_amount_cents=?,broker_id=?,commission_amount_cents=?,commission_mode=?,commission_value=?,notes=?,updated_at=? WHERE id=?").bind(data.businessType,data.date,data.supplierId,kilogramsMilli(amounts.effectiveKg),kilogramsMilli(amounts.contractedKg),amounts.receivedKg==null?null:kilogramsMilli(amounts.receivedKg),cents(data.pricePerSack),amounts.gross,amounts.adjust,amounts.total,firstBroker?.brokerId??null,totalCommission,firstBroker?.commissionMode??"AMOUNT",firstBroker?.commissionValue??"0",optional(data.notes),stamp,dealId),
    db.prepare("DELETE FROM deal_brokers WHERE deal_id=?").bind(dealId),
    ...brokerRows.map((row,index)=>db.prepare("INSERT INTO deal_brokers(id,deal_id,broker_id,position,commission_mode,commission_value,commission_amount_cents,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id(),dealId,row.brokerId,index+1,row.commissionMode,row.commissionValue,row.commissionAmount,stamp,stamp)),
    db.prepare("UPDATE installments SET number=-number,updated_at=? WHERE deal_id=?").bind(stamp,dealId),
  ];
  data.installments.forEach((part,index)=>{if(part.id)statements.push(db.prepare("UPDATE installments SET number=?,due_date=?,amount_cents=?,updated_at=? WHERE id=? AND deal_id=?").bind(index+1,part.dueDate,cents(part.amount),stamp,part.id,dealId));else statements.push(db.prepare("INSERT INTO installments(id,deal_id,number,due_date,amount_cents,paid_amount_cents,created_at,updated_at) VALUES(?,?,?,?,?,0,?,?)").bind(id(),dealId,index+1,part.dueDate,cents(part.amount),stamp,stamp))});
  oldParts.filter(part=>!incomingIds.has(String(part.id))).forEach(part=>statements.push(db.prepare("DELETE FROM installments WHERE id=? AND deal_id=?").bind(part.id,dealId)));
  statements.push(db.prepare("UPDATE bank_transactions SET counterparty=?,updated_at=? WHERE id IN (SELECT s.bank_transaction_id FROM settlements s JOIN installments i ON i.id=s.origin_id WHERE s.origin_type='INSTALLMENT' AND i.deal_id=?)").bind(party.legal_name,stamp,dealId));
  statements.push(db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,before_data,after_data,created_at) VALUES(?,'Deal',?,'UPDATE',?,?,?)").bind(id(),dealId,JSON.stringify(deal(old,oldParts,oldRelated.brokers)),JSON.stringify({contractedKilograms:data.kilograms,receivedKilograms:data.receivedKilograms??null,effectiveKilograms:amounts.effectiveKg,pricePerSack:data.pricePerSack,total:money(amounts.total),commission:money(totalCommission),brokers:brokerRows.length,installments:data.installments}),stamp));
  await db.batch(statements);
  const row=await db.prepare("SELECT d.*,p.legal_name,b.name broker_name FROM deals d JOIN people p ON p.id=d.party_id LEFT JOIN brokers b ON b.id=d.broker_id WHERE d.id=?").bind(dealId).first<Record<string,unknown>>(),related=await dealRelations(db,dealId);return deal(row!,related.parts,related.brokers,related.fiscal)
}

export async function deletePurchase(dealId:string){
  const db=d1(),dealRow=await db.prepare("SELECT d.*,p.legal_name party_name FROM deals d JOIN people p ON p.id=d.party_id WHERE d.id=? AND d.status='OPEN'").bind(dealId).first<Record<string,unknown>>();
  if(!dealRow)throw new Error("DEAL_NOT_FOUND");
  const stamp=now(),[settlements,funruralEntries,parts,brokers,documents]=await Promise.all([db.prepare("SELECT s.* FROM settlements s JOIN installments i ON i.id=s.origin_id WHERE s.origin_type='INSTALLMENT' AND i.deal_id=?").bind(dealId).all(),db.prepare("SELECT DISTINCT funrural_general_entry_id id FROM fiscal_documents WHERE deal_id=? AND funrural_general_entry_id IS NOT NULL").bind(dealId).all<{id:string}>(),db.prepare("SELECT * FROM installments WHERE deal_id=? ORDER BY number").bind(dealId).all(),db.prepare("SELECT * FROM deal_brokers WHERE deal_id=? ORDER BY position").bind(dealId).all(),db.prepare("SELECT id,access_key,purpose,status,deal_id,adjustment_deal_id,funrural_general_entry_id FROM fiscal_documents WHERE deal_id=? OR adjustment_deal_id=?").bind(dealId,dealId).all()]);
  const statements=[];
  for(const settlement of settlements.results)statements.push(db.prepare("UPDATE bank_transactions SET active=0,status='CANCELLED',reconciled=0,updated_at=? WHERE id=?").bind(stamp,settlement.bank_transaction_id));
  statements.push(
    db.prepare("UPDATE fiscal_documents SET deal_id=NULL,funrural_general_entry_id=NULL,status='PENDING',linked_at=NULL,updated_at=? WHERE deal_id=? AND purpose='DEAL'").bind(stamp,dealId),
    db.prepare("UPDATE fiscal_documents SET adjustment_deal_id=NULL,status=CASE WHEN general_entry_id IS NULL THEN 'PENDING' ELSE status END,linked_at=CASE WHEN general_entry_id IS NULL THEN NULL ELSE linked_at END,updated_at=? WHERE adjustment_deal_id=? AND purpose='SALE_RETURN'").bind(stamp,dealId),
    db.prepare("UPDATE deals SET status='CANCELLED',updated_at=? WHERE id=? AND status='OPEN'").bind(stamp,dealId),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,before_data,after_data,created_at) VALUES(?,'Deal',?,'DELETE',?,?,?)").bind(id(),dealId,JSON.stringify({deal:dealRow,installments:parts.results,brokers:brokers.results,fiscalDocuments:documents.results,settlements:settlements.results}),JSON.stringify({status:"CANCELLED",recoverable:true,hiddenFromOperationalViews:true}),stamp),
  );
  await db.batch(statements);
  for(const entry of funruralEntries.results)await recalculateFunruralEntry(db,String(entry.id));
  return{ok:true,deleted:true,recoverable:true,hiddenTransactions:settlements.results.length};
}

export async function brokerStatement(brokerId:string){
  const db=d1();
  const broker=await db.prepare("SELECT id,name FROM brokers WHERE id=? AND active=1").bind(brokerId).first<Record<string,unknown>>();
  if(!broker)throw new Error("BROKER_NOT_FOUND");
  const [credits,debits,accounts]=await Promise.all([
    db.prepare("SELECT d.id,d.sequence,d.business_type,d.date,d.kilograms_milli,d.price_per_sack_cents,db.commission_amount_cents,d.total_amount_cents,d.created_at,p.legal_name FROM deal_brokers db JOIN deals d ON d.id=db.deal_id JOIN people p ON p.id=d.party_id WHERE db.broker_id=? AND d.status='OPEN' AND db.commission_amount_cents>0 ORDER BY d.date,d.created_at").bind(brokerId).all(),
    db.prepare("SELECT cp.id,cp.payment_date,cp.amount_cents,cp.method,cp.document,cp.notes,cp.created_at,bt.status,ba.bank_name,ba.account_number FROM broker_commission_payments cp JOIN bank_transactions bt ON bt.id=cp.bank_transaction_id JOIN bank_accounts ba ON ba.id=bt.bank_account_id WHERE cp.broker_id=? AND bt.active=1 AND bt.status<>'CANCELLED' ORDER BY cp.payment_date,cp.created_at").bind(brokerId).all(),
    db.prepare("SELECT id,bank_name bankName,account_number accountNumber FROM bank_accounts WHERE active=1 ORDER BY bank_name,account_number").all(),
  ]);
  const entries=[
    ...credits.results.map(x=>({id:String(x.id),entryType:"COMMISSION" as const,date:String(x.date),createdAt:String(x.created_at),description:`Comissão de ${x.business_type==="PURCHASE"?"compra":"venda"} #${String(x.sequence).padStart(5,"0")}`,detail:String(x.legal_name),dealSacks:(Number(x.kilograms_milli)/60000).toFixed(3),dealPricePerSack:money(Number(x.price_per_sack_cents)),creditCents:Number(x.commission_amount_cents),debitCents:0,method:null,document:null})),
    ...debits.results.map(x=>({id:String(x.id),entryType:"PAYMENT" as const,date:String(x.payment_date),createdAt:String(x.created_at),description:"Pagamento de comissão",detail:`${String(x.bank_name)} · ${String(x.account_number)}`,dealSacks:null,dealPricePerSack:null,creditCents:0,debitCents:Number(x.amount_cents),method:String(x.method),document:x.document?String(x.document):null})),
  ].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
  let balanceCents=0;
  const ledger=entries.map(entry=>{balanceCents+=entry.creditCents-entry.debitCents;return{...entry,credit:money(entry.creditCents),debit:money(entry.debitCents),balance:money(balanceCents)}}).reverse();
  const totalCredits=credits.results.reduce((sum,x)=>sum+Number(x.commission_amount_cents),0);
  const totalDebits=debits.results.reduce((sum,x)=>sum+Number(x.amount_cents),0);
  return{broker:{id:String(broker.id),name:String(broker.name)},summary:{credits:money(totalCredits),paid:money(totalDebits),balance:money(totalCredits-totalDebits)},entries:ledger,accounts:accounts.results};
}

export async function brokerBalancesReport(){
  const db=d1();
  const result=await db.prepare(`SELECT
    b.id,
    b.name,
    COALESCE((SELECT SUM(db.commission_amount_cents) FROM deal_brokers db JOIN deals d ON d.id=db.deal_id WHERE db.broker_id=b.id AND d.status='OPEN'),0) credits,
    COALESCE((SELECT SUM(cp.amount_cents) FROM broker_commission_payments cp JOIN bank_transactions bt ON bt.id=cp.bank_transaction_id WHERE cp.broker_id=b.id AND bt.active=1 AND bt.status<>'CANCELLED'),0) paid
    FROM brokers b
    WHERE b.active=1
    ORDER BY b.name`).all();
  const rows=result.results.map(row=>{
    const creditsCents=Number(row.credits??0),paidCents=Number(row.paid??0),balanceCents=creditsCents-paidCents;
    return{id:String(row.id),name:String(row.name),credits:money(creditsCents),paid:money(paidCents),balance:money(balanceCents),creditsCents,paidCents,balanceCents};
  }).filter(row=>row.balanceCents>0).sort((a,b)=>b.balanceCents-a.balanceCents||a.name.localeCompare(b.name,"pt-BR"));
  const creditsCents=rows.reduce((sum,row)=>sum+row.creditsCents,0);
  const paidCents=rows.reduce((sum,row)=>sum+row.paidCents,0);
  const balanceCents=rows.reduce((sum,row)=>sum+row.balanceCents,0);
  return{rows:rows.map(row=>({id:row.id,name:row.name,credits:row.credits,paid:row.paid,balance:row.balance})),summary:{count:rows.length,credits:money(creditsCents),paid:money(paidCents),balance:money(balanceCents)}};
}

export async function createBrokerCommissionPayment(brokerId:string,input:unknown){
  const data=brokerCommissionPaymentSchema.parse(input),db=d1();
  const duplicate=await db.prepare("SELECT id,bank_transaction_id bankTransactionId,amount_cents amountCents FROM broker_commission_payments WHERE operation_key=?").bind(data.operationKey).first<{id:string;bankTransactionId:string;amountCents:number}>();
  if(duplicate)return{id:duplicate.id,bankTransactionId:duplicate.bankTransactionId,amount:money(duplicate.amountCents)};
  const broker=await db.prepare("SELECT id,name FROM brokers WHERE id=? AND active=1").bind(brokerId).first<{id:string;name:string}>();
  if(!broker)throw new Error("BROKER_NOT_FOUND");
  const account=await db.prepare("SELECT id FROM bank_accounts WHERE id=? AND active=1").bind(data.bankAccountId).first();
  if(!account)throw new Error("BANK_ACCOUNT_NOT_FOUND");
  const totals=await db.prepare(`SELECT
    COALESCE((SELECT SUM(db.commission_amount_cents) FROM deal_brokers db JOIN deals d ON d.id=db.deal_id WHERE db.broker_id=? AND d.status='OPEN'),0) credits,
    COALESCE((SELECT SUM(cp.amount_cents) FROM broker_commission_payments cp JOIN bank_transactions bt ON bt.id=cp.bank_transaction_id WHERE cp.broker_id=? AND bt.active=1 AND bt.status<>'CANCELLED'),0) debits`).bind(brokerId,brokerId).first<{credits:number;debits:number}>();
  const amountCents=cents(data.amount),balance=Number(totals?.credits??0)-Number(totals?.debits??0);
  if(amountCents>balance)throw new Error("COMMISSION_EXCEEDS_BALANCE");
  let category=await db.prepare("SELECT id,active FROM financial_categories WHERE code='COMISSAO'").first<{id:string;active:number}>();
  if(!category){const categoryId=id(),stamp=now();await db.prepare("INSERT INTO financial_categories(id,code,name,type,description,active,created_at,updated_at) VALUES(?,'COMISSAO','Comissões','EXPENSE','Pagamentos de comissões a corretores',1,?,?)").bind(categoryId,stamp,stamp).run();category={id:categoryId,active:1}}
  else if(!category.active){await db.prepare("UPDATE financial_categories SET active=1,updated_at=? WHERE id=?").bind(now(),category.id).run()}
  const stamp=now(),bankTransactionId=id(),paymentId=id();
  await db.batch([
    db.prepare("INSERT INTO bank_transactions(id,bank_account_id,direction,method,status,due_date,movement_date,amount_cents,counterparty,description,document,check_number,reconciled,notes,operation_key,financial_category_id,active,created_at,updated_at) VALUES(?,?,'OUT',?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)").bind(bankTransactionId,data.bankAccountId,data.method,data.status,data.movementDate,data.movementDate,amountCents,broker.name,"Pagamento de comissão",optional(data.document),optional(data.checkNumber),data.status === "CLEARED" ? 1 : 0,optional(data.notes),data.operationKey,category.id,stamp,stamp),
    db.prepare("INSERT INTO broker_commission_payments(id,broker_id,bank_transaction_id,amount_cents,operation_key,payment_date,method,document,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(paymentId,brokerId,bankTransactionId,amountCents,data.operationKey,data.movementDate,data.method,optional(data.document),optional(data.notes),stamp,stamp),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'BrokerCommissionPayment',?,'CREATE',?,?)").bind(id(),paymentId,JSON.stringify({brokerId,amount:money(amountCents),method:data.method,bankTransactionId}),stamp),
  ]);
  return{id:paymentId,bankTransactionId,amount:money(amountCents),balance:money(balance-amountCents)};
}

const bounds=(start?:string|null,end?:string|null)=>({start:start||"0000-01-01",end:end||"9999-12-31"});
export async function businessReport(type:"PURCHASE"|"SALE",start?:string|null,end?:string|null,personId?:string|null){const db=d1(),p=bounds(start,end),selectedPerson=normalizeOptionalFilter(personId);const rows=await db.prepare("SELECT d.*,pe.legal_name,b.name broker_name FROM deals d JOIN people pe ON pe.id=d.party_id LEFT JOIN brokers b ON b.id=d.broker_id WHERE d.business_type=? AND d.status='OPEN' AND d.date BETWEEN ? AND ? AND (? IS NULL OR d.party_id=?) ORDER BY d.date,d.sequence").bind(type,p.start,p.end,selectedPerson,selectedPerson).all();const parsed=rows.results.map(r=>deal(r));const kg=rows.results.reduce((s,r)=>s+Number(r.kilograms_milli),0),amount=rows.results.reduce((s,r)=>s+Number(r.total_amount_cents),0),sacks=kg/60000;return{rows:parsed,summary:{count:parsed.length,kilograms:kilograms(kg),sacks:sacks.toFixed(3),amount:money(amount),averagePrice:sacks?money(Math.round(amount/sacks)):"0.00"}}}

export async function dailyMap(start?:string|null,end?:string|null,personId?:string|null,direction?:string|null){
 const db=d1(),period=bounds(start,end),filter=normalizeReportDirection(direction),selectedPerson=normalizeOptionalFilter(personId);
 const coffee=await db.prepare("SELECT i.*,d.business_type,d.sequence,d.kilograms_milli,d.price_per_sack_cents,d.party_id,pe.legal_name FROM installments i JOIN deals d ON d.id=i.deal_id JOIN people pe ON pe.id=d.party_id WHERE d.status='OPEN' AND i.amount_cents>i.paid_amount_cents AND i.due_date BETWEEN ? AND ? AND (? IS NULL OR d.party_id=?) AND (? IS NULL OR (?='PAYABLE' AND d.business_type='PURCHASE') OR (?='RECEIVABLE' AND d.business_type='SALE')) ORDER BY i.due_date").bind(period.start,period.end,selectedPerson,selectedPerson,filter,filter,filter).all();
 const general=await db.prepare("SELECT g.*,c.name category_name,p.legal_name FROM general_entries g JOIN financial_categories c ON c.id=g.category_id LEFT JOIN people p ON p.id=g.person_id WHERE g.active=1 AND g.amount_cents>g.paid_amount_cents AND g.due_date BETWEEN ? AND ? AND (? IS NULL OR g.person_id=?) AND (? IS NULL OR g.direction=?) ORDER BY g.due_date").bind(period.start,period.end,selectedPerson,selectedPerson,filter,filter).all();
 const days=new Map<string,{date:string;payable:number;receivable:number;entries:Record<string,unknown>[]}>();
 const get=(date:string)=>days.get(date)??{date,payable:0,receivable:0,entries:[]};
 for(const entry of coffee.results){const day=get(String(entry.due_date)),open=Number(entry.amount_cents)-Number(entry.paid_amount_cents),pay=entry.business_type==="PURCHASE";if(pay)day.payable+=open;else day.receivable+=open;day.entries.push({id:entry.id,number:entry.number,amount:money(Number(entry.amount_cents)),paidAmount:money(Number(entry.paid_amount_cents)),sacks:(Number(entry.kilograms_milli)/60000).toFixed(3),pricePerSack:money(Number(entry.price_per_sack_cents)),origin:"CAFE",description:"Café",purchase:{businessType:entry.business_type,sequence:entry.sequence,supplier:{legalName:entry.legal_name}}});days.set(day.date,day)}
 for(const entry of general.results){const day=get(String(entry.due_date)),open=Number(entry.amount_cents)-Number(entry.paid_amount_cents),pay=entry.direction==="PAYABLE";if(pay)day.payable+=open;else day.receivable+=open;day.entries.push({id:entry.id,number:1,amount:money(Number(entry.amount_cents)),paidAmount:money(Number(entry.paid_amount_cents)),sacks:null,pricePerSack:null,origin:"GENERAL",description:`${entry.description} · ${entry.category_name}`,purchase:{businessType:pay?"PURCHASE":"SALE",sequence:0,supplier:{legalName:entry.legal_name??"Sem pessoa vinculada"}}});days.set(day.date,day)}
 let cumulative=0;return[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(day=>{const balance=day.receivable-day.payable;cumulative+=balance;return{...day,payable:money(day.payable),receivable:money(day.receivable),balance:money(balance),cumulative:money(cumulative)}})
}

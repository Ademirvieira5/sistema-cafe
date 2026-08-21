import { d1, now } from "@/lib/d1";

const TABLES=["people","person_roles","brokers","financial_categories","bank_accounts","deals","deal_brokers","installments","fiscal_documents","general_entries","imported_documents","funrural_periods","bank_transactions","settlements","broker_commission_payments","inventory_settings","inventory_month_closings","cheque_batches","cheques","cheque_events","audit_logs"] as const;

function bucket(){const value=(globalThis as typeof globalThis&{__SISTEMA_CAFE_BUCKET?:R2Bucket}).__SISTEMA_CAFE_BUCKET;if(!value)throw new Error("BACKUP_STORAGE_UNAVAILABLE");return value}

async function objectInventory(){const keys:string[]=[];let cursor: string|undefined;do{const page=await bucket().list({cursor,limit:1000});for(const object of page.objects)if(!object.key.startsWith("backups/"))keys.push(object.key);cursor=page.truncated?page.cursor:undefined}while(cursor);return keys}

export async function safetyStatus(){
 const db=d1(),checks=await db.batch([
  db.prepare("SELECT COUNT(*) value FROM deals WHERE status='OPEN'"),
  db.prepare("SELECT COUNT(*) value FROM bank_transactions WHERE active=1 AND status<>'CANCELLED'"),
  db.prepare("SELECT COUNT(*) value FROM fiscal_documents WHERE status<>'CANCELLED'"),
  db.prepare("SELECT COUNT(*) value FROM audit_logs"),
  db.prepare("SELECT COUNT(*) value FROM installments i LEFT JOIN deals d ON d.id=i.deal_id WHERE d.id IS NULL"),
  db.prepare("SELECT COUNT(*) value FROM settlements s LEFT JOIN bank_transactions b ON b.id=s.bank_transaction_id WHERE b.id IS NULL"),
  db.prepare("SELECT COUNT(*) value FROM fiscal_documents f LEFT JOIN deals d ON d.id=f.deal_id WHERE f.deal_id IS NOT NULL AND d.id IS NULL"),
  db.prepare("SELECT COUNT(*) value FROM installments WHERE paid_amount_cents<0 OR paid_amount_cents>amount_cents"),
 ]),values=checks.map(item=>Number((item.results?.[0] as Record<string,unknown>|undefined)?.value||0));
 const listed=await bucket().list({prefix:"backups/",limit:30}),backups=listed.objects.sort((a,b)=>b.uploaded.getTime()-a.uploaded.getTime()).map(object=>({key:object.key,size:object.size,uploadedAt:object.uploaded.toISOString()}));
 return{checkedAt:now(),counts:{deals:values[0],bankTransactions:values[1],fiscalDocuments:values[2],auditLogs:values[3]},integrity:{ok:values.slice(4).every(value=>value===0),issues:values.slice(4).reduce((sum,value)=>sum+value,0)},backups};
}

export async function createBackup(force=false){
 const storage=bucket(),day=new Date().toISOString().slice(0,10),prefix=`backups/${day}/`;
 if(!force){const existing=await storage.list({prefix,limit:1});if(existing.objects.length)return{created:false,key:existing.objects[0].key,reason:"ALREADY_CREATED_TODAY"}}
 const db=d1(),results=await db.batch(TABLES.map(table=>db.prepare(`SELECT * FROM ${table}`))),files=await objectInventory(),createdAt=now(),key=`${prefix}sistema-cafe-${createdAt.replace(/[:.]/g,"-")}.json.gz`;
 const tables=Object.fromEntries(TABLES.map((table,index)=>[table,results[index].results??[]])),payload=JSON.stringify({format:"sistema-cafe-backup",version:1,createdAt,tables,storedFiles:files});
 const body=new Blob([payload],{type:"application/json"}).stream().pipeThrough(new CompressionStream("gzip"));
 await storage.put(key,body,{httpMetadata:{contentType:"application/gzip",contentDisposition:`attachment; filename="backup-sistema-cafe-${day}.json.gz"`},customMetadata:{createdAt,formatVersion:"1",tableCount:String(TABLES.length),fileCount:String(files.length)}});
 return{created:true,key,createdAt,records:results.reduce((sum,item)=>sum+(item.results?.length??0),0),files:files.length};
}

export async function downloadBackup(key:string){if(!/^backups\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9._-]+\.json\.gz$/.test(key))throw new Error("BACKUP_NOT_FOUND");return bucket().get(key)}

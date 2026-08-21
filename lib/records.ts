import { d1, id, now, cents, money, bool, optional } from "@/lib/d1";
import { ModuleName, moduleSchemas } from "@/lib/validation";

type Status = "ativos" | "inativos" | "todos";
const active = (status: Status) => status === "todos" ? "" : ` AND active = ${status === "ativos" ? 1 : 0}`;
const like = (search: string) => `%${search}%`;

function person(row: Record<string, unknown>, roles: string[] = []) { return { id:row.id,personType:row.person_type,classification:row.classification,legalName:row.legal_name,tradeName:row.trade_name,cpfCnpj:row.cpf_cnpj,rgIe:row.rg_ie,email:row.email,phone:row.phone,zipCode:row.zip_code,street:row.street,number:row.number,complement:row.complement,district:row.district,city:row.city,state:row.state,country:row.country,funruralStatus:row.funrural_status,source:row.source,legacySourceKey:row.legacy_source_key,lastInvoiceAt:row.last_invoice_at,lastImportedAt:row.last_imported_at,notes:row.notes,active:Boolean(row.active),roles:roles.map(role=>({role})) }; }
function broker(row:Record<string,unknown>){return{id:row.id,personType:row.person_type,name:row.name,tradeName:row.trade_name,cpfCnpj:row.cpf_cnpj,rgIe:row.rg_ie,email:row.email,phone:row.phone,pixKey:row.pix_key,notes:row.notes,active:Boolean(row.active)}}
function category(row:Record<string,unknown>){return{id:row.id,code:row.code,name:row.name,type:row.type,description:row.description,active:Boolean(row.active)}}
function account(row:Record<string,unknown>){return{id:row.id,bankCode:row.bank_code,bankName:row.bank_name,agency:row.agency,accountNumber:row.account_number,accountDigit:row.account_digit,type:row.type,description:row.description,openingBalance:money(Number(row.opening_balance_cents)),active:Boolean(row.active)}}

async function syncBrokerProfile(db:ReturnType<typeof d1>, personId:string, data:Record<string,unknown>, stamp:string, enabled:boolean){
 const document=optional(data.cpfCnpj);
 const existing=await db.prepare("SELECT id FROM brokers WHERE id=? OR (? IS NOT NULL AND cpf_cnpj=?) ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1").bind(personId,document,document,personId).first<{id:string}>();
 if(!enabled){
  if(existing)await db.prepare("UPDATE brokers SET active=0,updated_at=? WHERE id=?").bind(stamp,existing.id).run();
  return;
 }
 if(existing){
  await db.prepare("UPDATE brokers SET person_type=?,name=?,trade_name=?,cpf_cnpj=?,rg_ie=?,email=?,phone=?,notes=?,active=?,updated_at=? WHERE id=?").bind(data.personType,data.legalName,optional(data.tradeName),document,optional(data.rgIe),optional(data.email),optional(data.phone),optional(data.notes),bool(data.active as boolean),stamp,existing.id).run();
  return;
 }
 await db.prepare("INSERT INTO brokers(id,person_type,name,trade_name,cpf_cnpj,rg_ie,email,phone,pix_key,notes,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(personId,data.personType,data.legalName,optional(data.tradeName),document,optional(data.rgIe),optional(data.email),optional(data.phone),null,optional(data.notes),bool(data.active as boolean),stamp,stamp).run();
}

export async function listRecords(module:ModuleName, search:string, status:Status){const db=d1();const q=like(search);
 if(module==="pessoas"){
  const [rows,roleRows]=await Promise.all([
   db.prepare(`SELECT * FROM people WHERE (legal_name LIKE ? OR COALESCE(trade_name,'') LIKE ? OR COALESCE(cpf_cnpj,'') LIKE ?)${active(status)} ORDER BY legal_name`).bind(q,q,q).all(),
   db.prepare("SELECT person_id,role FROM person_roles ORDER BY person_id,role").all(),
  ]);
  const rolesByPerson=new Map<string,string[]>();
  for(const roleRow of roleRows.results){const personId=String(roleRow.person_id),roles=rolesByPerson.get(personId)??[];roles.push(String(roleRow.role));rolesByPerson.set(personId,roles)}
  return rows.results.map(row=>person(row,rolesByPerson.get(String(row.id))??[]));
 }
 if(module==="corretores"){const r=await db.prepare(`SELECT * FROM brokers WHERE (name LIKE ? OR COALESCE(trade_name,'') LIKE ? OR COALESCE(cpf_cnpj,'') LIKE ?)${active(status)} ORDER BY name`).bind(q,q,q).all();return r.results.map(broker)}
 if(module==="categorias"){const r=await db.prepare(`SELECT * FROM financial_categories WHERE (name LIKE ? OR COALESCE(code,'') LIKE ?)${active(status)} ORDER BY name`).bind(q,q).all();return r.results.map(category)}
 const r=await db.prepare(`SELECT * FROM bank_accounts WHERE (bank_name LIKE ? OR COALESCE(description,'') LIKE ? OR account_number LIKE ?)${active(status)} ORDER BY bank_name,account_number`).bind(q,q,q).all();return r.results.map(account)
}

export async function createRecord(module:ModuleName,input:unknown){const data=moduleSchemas[module].parse(input) as Record<string,unknown>;const db=d1(),recordId=id(),stamp=now();
 if(module==="pessoas"){const roles=data.roles as string[];await db.batch([db.prepare("INSERT INTO people(id,person_type,classification,legal_name,trade_name,cpf_cnpj,rg_ie,email,phone,zip_code,street,number,complement,district,city,state,country,funrural_status,source,notes,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(recordId,data.personType,data.classification,data.legalName,optional(data.tradeName),optional(data.cpfCnpj),optional(data.rgIe),optional(data.email),optional(data.phone),optional(data.zipCode),optional(data.street),optional(data.number),optional(data.complement),optional(data.district),optional(data.city),optional(data.state),data.country,data.funruralStatus,"MANUAL",optional(data.notes),bool(data.active as boolean),stamp,stamp),...roles.map(role=>db.prepare("INSERT INTO person_roles(person_id,role) VALUES(?,?)").bind(recordId,role))]);await syncBrokerProfile(db,recordId,data,stamp,roles.includes("BROKER"));return person({...data,id:recordId,person_type:data.personType,classification:data.classification,legal_name:data.legalName,trade_name:data.tradeName,cpf_cnpj:data.cpfCnpj,rg_ie:data.rgIe,zip_code:data.zipCode,country:data.country,funrural_status:data.funruralStatus,source:"MANUAL",active:bool(data.active as boolean)},roles)}
 if(module==="corretores"){await db.prepare("INSERT INTO brokers(id,person_type,name,trade_name,cpf_cnpj,rg_ie,email,phone,pix_key,notes,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(recordId,data.personType,data.name,optional(data.tradeName),optional(data.cpfCnpj),optional(data.rgIe),optional(data.email),optional(data.phone),optional(data.pixKey),optional(data.notes),bool(data.active),stamp,stamp).run();return{...data,id:recordId}}
 if(module==="categorias"){await db.prepare("INSERT INTO financial_categories(id,code,name,type,description,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(recordId,optional(data.code),data.name,data.type,optional(data.description),bool(data.active),stamp,stamp).run();return{...data,id:recordId}}
 await db.prepare("INSERT INTO bank_accounts(id,bank_code,bank_name,agency,account_number,account_digit,type,description,opening_balance_cents,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(recordId,optional(data.bankCode),data.bankName,optional(data.agency),data.accountNumber,optional(data.accountDigit),data.type,optional(data.description),cents(data.openingBalance),bool(data.active),stamp,stamp).run();return{...data,id:recordId}
}

export async function updateRecord(module:ModuleName,recordId:string,input:unknown){const data=moduleSchemas[module].parse(input) as Record<string,unknown>;const db=d1(),stamp=now();
 if(module==="pessoas"){const roles=data.roles as string[];await db.batch([db.prepare("UPDATE people SET person_type=?,classification=?,legal_name=?,trade_name=?,cpf_cnpj=?,rg_ie=?,email=?,phone=?,zip_code=?,street=?,number=?,complement=?,district=?,city=?,state=?,country=?,funrural_status=?,notes=?,active=?,updated_at=? WHERE id=?").bind(data.personType,data.classification,data.legalName,optional(data.tradeName),optional(data.cpfCnpj),optional(data.rgIe),optional(data.email),optional(data.phone),optional(data.zipCode),optional(data.street),optional(data.number),optional(data.complement),optional(data.district),optional(data.city),optional(data.state),data.country,data.funruralStatus,optional(data.notes),bool(data.active as boolean),stamp,recordId),db.prepare("DELETE FROM person_roles WHERE person_id=?").bind(recordId),...roles.map(role=>db.prepare("INSERT INTO person_roles(person_id,role) VALUES(?,?)").bind(recordId,role))]);await syncBrokerProfile(db,recordId,data,stamp,roles.includes("BROKER"));return{...data,id:recordId}}
 if(module==="corretores")await db.prepare("UPDATE brokers SET person_type=?,name=?,trade_name=?,cpf_cnpj=?,rg_ie=?,email=?,phone=?,pix_key=?,notes=?,active=?,updated_at=? WHERE id=?").bind(data.personType,data.name,optional(data.tradeName),optional(data.cpfCnpj),optional(data.rgIe),optional(data.email),optional(data.phone),optional(data.pixKey),optional(data.notes),bool(data.active),stamp,recordId).run();
 else if(module==="categorias")await db.prepare("UPDATE financial_categories SET code=?,name=?,type=?,description=?,active=?,updated_at=? WHERE id=?").bind(optional(data.code),data.name,data.type,optional(data.description),bool(data.active),stamp,recordId).run();
 else await db.prepare("UPDATE bank_accounts SET bank_code=?,bank_name=?,agency=?,account_number=?,account_digit=?,type=?,description=?,opening_balance_cents=?,active=?,updated_at=? WHERE id=?").bind(optional(data.bankCode),data.bankName,optional(data.agency),data.accountNumber,optional(data.accountDigit),data.type,optional(data.description),cents(data.openingBalance),bool(data.active),stamp,recordId).run();return{...data,id:recordId}
}

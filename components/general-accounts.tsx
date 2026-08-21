"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { SettlementModal } from "@/components/settlement-modal";
import { clientOperationKey } from "@/lib/client-id";
import { MoneyInput } from "@/components/money-input";
import { moneyFromDecimal } from "@/lib/money-input";
import { QuickCreateSelect } from "@/components/quick-create-select";

type Opt={id:string;name?:string;legalName?:string};
type Entry={id:string;direction:"PAYABLE"|"RECEIVABLE";description:string;dueDate:string;amount:string;paidAmount:string;fixedMonthly:boolean;managedByXml:boolean;notes?:string|null;category:{id:string;name:string};person?:{id:string;legalName:string}|null};
type Account={id:string;bankName:string;accountNumber:string};
type FormState={operationKey:string;direction:"PAYABLE"|"RECEIVABLE";description:string;categoryId:string;personId:string;dueDate:string;amount:string;fixedMonthly:boolean;notes:string};

const money=(value:string|number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value));
const today=()=>new Date().toISOString().slice(0,10);
const blankForm=():FormState=>({operationKey:clientOperationKey(),direction:"PAYABLE",description:"",categoryId:"",personId:"",dueDate:today(),amount:"",fixedMonthly:false,notes:""});

export function GeneralAccounts({options}:{options:{categories:Opt[];people:Opt[];accounts:Account[]}}){
 const formRef=useRef<HTMLFormElement>(null);
 const[items,setItems]=useState<Entry[]>([]),[open,setOpen]=useState(false),[editing,setEditing]=useState<Entry|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const[settlement,setSettlement]=useState<{id:string;label:string;remaining:string;direction:"PAYABLE"|"RECEIVABLE"}|null>(null);
 const[form,setForm]=useState<FormState>(blankForm);
 const load=useCallback(async()=>{const response=await fetch("/api/contas-gerais"),body=await response.json();if(response.ok)setItems(body);else setError(body.error||"Não foi possível carregar.")},[]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[load]);
 useEffect(()=>{function saveWithF2(event:KeyboardEvent){if(event.key==="F2"&&open&&!busy){event.preventDefault();formRef.current?.requestSubmit()}}window.addEventListener("keydown",saveWithF2);return()=>window.removeEventListener("keydown",saveWithF2)},[open,busy]);

 function startNew(){setEditing(null);setForm(blankForm());setError("");setOpen(true)}
 function startEdit(entry:Entry){setEditing(entry);setForm({operationKey:clientOperationKey(),direction:entry.direction,description:entry.description,categoryId:entry.category.id,personId:entry.person?.id??"",dueDate:entry.dueDate,amount:moneyFromDecimal(entry.amount),fixedMonthly:entry.fixedMonthly,notes:entry.notes??""});setError("");setOpen(true)}
 function close(){if(busy)return;setOpen(false);setEditing(null);setError("")}

 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError("");
  const response=await fetch(editing?`/api/contas-gerais/${editing.id}`:"/api/contas-gerais",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}),body=await response.json();setBusy(false);
  if(!response.ok){setError(body.error||"Não foi possível salvar.");return}close();await load();
 }

 async function cancel(entry:Entry){
  if(busy||!confirm(`Cancelar o lançamento “${entry.description}”?`))return;setBusy(true);setError("");
  const response=await fetch(`/api/contas-gerais/${entry.id}`,{method:"DELETE"}),body=await response.json();setBusy(false);
  if(!response.ok){setError(body.error||"Não foi possível cancelar.");return}await load();
 }

 return <div className="page"><header className="records-header"><div><span className="eyebrow">Financeiro geral</span><h1>Contas a pagar e receber</h1><p className="page-subtitle">Despesas fixas mensais, eventuais e outras receitas fora do café.</p></div><button className="primary-button" onClick={startNew}><Plus size={16}/>Novo lançamento</button></header>{error&&!open&&<div className="form-error">{error}</div>}<section className="records-panel accounts-panel"><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Frequência</th><th>Valor</th><th>Saldo</th><th>Ações</th></tr></thead><tbody>{items.map(entry=>{const remaining=Number(entry.amount)-Number(entry.paidAmount);return <tr key={entry.id}><td><span className={`business-badge ${entry.direction==="PAYABLE"?"payable":"sale"}`}>{entry.direction==="PAYABLE"?"A pagar":"A receber"}</span></td><td>{new Date(`${entry.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</td><td><strong>{entry.description}</strong>{entry.managedByXml&&<small className="managed-entry">Somado automaticamente pelos XMLs</small>}</td><td>{entry.category.name}</td><td>{entry.managedByXml?"Competência mensal":entry.fixedMonthly?"Mensal (12 meses)":"Eventual"}</td><td>{money(entry.amount)}</td><td><strong>{money(remaining)}</strong></td><td><div className="bank-row-actions">{remaining>0&&<button className="table-action" disabled={busy} onClick={()=>setSettlement({id:entry.id,label:entry.description,remaining:remaining.toFixed(2),direction:entry.direction})}>{entry.direction==="PAYABLE"?"Pagar":"Receber"}</button>}{!entry.managedByXml&&<><button className="edit-deal" disabled={busy} onClick={()=>startEdit(entry)}><Pencil size={14}/>Editar</button><button className="reconcile-button cancel" disabled={busy} onClick={()=>cancel(entry)}><Trash2 size={14}/>Cancelar</button></>}</div></td></tr>})}</tbody></table></div></section>
 {settlement&&<SettlementModal key={settlement.id} origin={{type:"GENERAL_ENTRY",...settlement}} accounts={options.accounts} onClose={()=>setSettlement(null)} onSaved={load}/>} {open&&<div className="modal-layer"><div className="form-modal"><div className="modal-header"><div><span className="eyebrow">Conta geral</span><h2>{editing?"Editar lançamento":"Novo lançamento"}</h2></div><button onClick={close}><X/></button></div><form ref={formRef} onSubmit={submit}><div className="modal-body">{error&&<div className="form-error">{error}</div>}<fieldset className="form-section"><legend>Dados do lançamento</legend><div className="business-toggle"><button type="button" className={form.direction==="PAYABLE"?"selected":""} onClick={()=>setForm({...form,direction:"PAYABLE"})}>A pagar</button><button type="button" className={form.direction==="RECEIVABLE"?"selected sale":""} onClick={()=>setForm({...form,direction:"RECEIVABLE"})}>A receber</button></div><div className="form-grid"><label className="field"><span>Descrição <b>*</b></span><input required value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></label><QuickCreateSelect label="Categoria" createLabel="categoria" module="categorias" categoryType={form.direction==="PAYABLE"?"EXPENSE":"INCOME"} required value={form.categoryId} onChange={categoryId=>setForm({...form,categoryId})} options={options.categories.map(category=>({id:category.id,label:category.name||""}))} initialValues={{type:form.direction==="PAYABLE"?"EXPENSE":"INCOME"}}/><label className="field"><span>Vencimento <b>*</b></span><input type="date" required value={form.dueDate} onChange={event=>setForm({...form,dueDate:event.target.value})}/></label><label className="field"><span>Valor <b>*</b></span><MoneyInput required value={form.amount} onValueChange={amount=>setForm({...form,amount})} placeholder="0,00"/></label><QuickCreateSelect label="Pessoa (opcional)" createLabel="pessoa" module="pessoas" value={form.personId} onChange={personId=>setForm({...form,personId})} options={options.people.map(person=>({id:person.id,label:person.legalName||""}))} placeholder="Sem vínculo" initialValues={{roles:[form.direction==="PAYABLE"?"SUPPLIER":"CUSTOMER"]}}/><label className="checkbox-line"><input type="checkbox" checked={form.fixedMonthly} onChange={event=>setForm({...form,fixedMonthly:event.target.checked})}/>{editing?"Marcar como conta mensal":"Repetir mensalmente por 12 meses"}</label>{form.fixedMonthly&&!editing&&<small>Serão criados 12 lançamentos, começando neste vencimento.</small>}</div></fieldset><fieldset className="form-section"><legend>Observações</legend><label className="field"><textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></label></fieldset></div><div className="modal-footer"><button type="button" className="secondary-button" onClick={close} disabled={busy}>Cancelar</button><button className="primary-button" disabled={busy}>{busy?"Salvando...":<>{editing?"Salvar alterações":"Salvar lançamento"} <kbd>F2</kbd></>}</button></div></form></div></div>}</div>;
}

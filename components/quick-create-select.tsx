"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Plus, X } from "lucide-react";
import { createPortal } from "react-dom";
import { MoneyInput } from "@/components/money-input";
import { defaultValues, FieldConfig, moduleConfigs } from "@/lib/modules";

type ModuleName = "pessoas" | "corretores" | "categorias" | "contas";
type FormValue = string | boolean | string[];
type RecordData = Record<string, unknown> & { id: string };
export type QuickOption = { id: string; label: string };
const QUICK_RECORD_CREATED = "cadastro:registro-criado";

type Props = {
  label: string;
  module: ModuleName;
  value: string;
  onChange: (value: string) => void;
  options: QuickOption[];
  required?: boolean;
  placeholder?: string;
  createLabel?: string;
  initialValues?: Record<string, FormValue>;
  role?: "SUPPLIER" | "CUSTOMER" | "BROKER";
  categoryType?: "EXPENSE" | "INCOME";
};

const recordLabel = (module: ModuleName, record: RecordData) => {
  if (module === "pessoas") return String(record.legalName || "Pessoa cadastrada");
  if (module === "corretores") return String(record.name || "Corretor cadastrado");
  if (module === "categorias") return `${record.code ? `${record.code} · ` : ""}${String(record.name || "Categoria cadastrada")}`;
  return `${String(record.description || record.bankName || "Conta bancária")} · ${String(record.accountNumber || "")}`.replace(/ · $/, "");
};

const hasRole = (record: RecordData, role?: "SUPPLIER" | "CUSTOMER" | "BROKER") => {
  if (!role) return true;
  return Array.isArray(record.roles) && record.roles.some(item => typeof item === "object" && item !== null && (item as { role?: string }).role === role);
};

export function QuickCreateSelect({ label, module, value, onChange, options, required, placeholder = "Selecione", createLabel, initialValues = {}, role, categoryType }: Props) {
  const [open, setOpen] = useState(false);
  const [loadedRecords, setLoadedRecords] = useState<QuickOption[]>([]);
  const records = useMemo(() => mergeOptions(options, loadedRecords), [options, loadedRecords]);

  useEffect(() => {
    let active = true;
    fetch(`/api/cadastros/${module}?status=ativos`).then(response => response.json()).then((body: RecordData[]) => {
      if (!active || !Array.isArray(body)) return;
      const applicable = body.filter(record => hasRole(record, role) && (!categoryType || record.type === categoryType || record.type === "BOTH"));
      setLoadedRecords(applicable.map(record => ({ id: record.id, label: recordLabel(module, record) })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [categoryType, module, role]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ module?: ModuleName; record?: RecordData }>).detail;
      if (detail?.module !== module || !detail.record) return;
      const record = detail.record;
      if (!hasRole(record, role) || (categoryType && record.type !== categoryType && record.type !== "BOTH")) return;
      setLoadedRecords(current => mergeOptions(current, [{ id: record.id, label: recordLabel(module, record) }]));
    };
    window.addEventListener(QUICK_RECORD_CREATED, refresh);
    return () => window.removeEventListener(QUICK_RECORD_CREATED, refresh);
  }, [categoryType, module, role]);

  return <>
    <label className="field quick-select-field">
      <span>{label}{required && <b>*</b>}</span>
      <span className="select-create-row">
        <select required={required} value={value} onChange={event => onChange(event.target.value)}>
          <option value="">{placeholder}</option>
          {records.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select>
        <button type="button" className="quick-create-button" onClick={() => setOpen(true)} title={`Cadastrar ${createLabel || label}`} aria-label={`Cadastrar ${createLabel || label}`}><Plus size={16}/><span>Novo</span></button>
      </span>
      {!records.length && <small className="quick-empty">Nenhum cadastro ainda. Use “Novo” para cadastrar agora.</small>}
    </label>
    {open && <QuickCreateModal module={module} title={createLabel || label} initialValues={initialValues} onClose={() => setOpen(false)} onCreated={record => {
      window.dispatchEvent(new CustomEvent(QUICK_RECORD_CREATED, { detail: { module, record } }));
      onChange(record.id);
      setOpen(false);
    }}/>} 
  </>;
}

function mergeOptions(...lists: QuickOption[][]) {
  const map = new Map<string, QuickOption>();
  lists.flat().forEach(option => map.set(option.id, option));
  return [...map.values()];
}

function QuickCreateModal({ module, title, initialValues, onClose, onCreated }: { module: ModuleName; title: string; initialValues: Record<string, FormValue>; onClose: () => void; onCreated: (record: RecordData) => void }) {
  const config = moduleConfigs[module];
  const defaults = useMemo(() => ({ ...defaultValues(config), ...initialValues, active: true }), [config, initialValues]);
  const [form, setForm] = useState<Record<string, FormValue>>(defaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    const response = await fetch(`/api/cadastros/${module}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) { setError(body.error || "Não foi possível concluir o cadastro."); return; }
    onCreated(body);
  }

  return createPortal(<div className="modal-layer quick-create-layer" role="presentation">
    <section className="form-modal quick-create-modal" role="dialog" aria-modal="true" aria-label={`Cadastrar ${title}`}>
      <header className="modal-header"><div><span className="eyebrow">Cadastro sem sair do lançamento</span><h2>Cadastrar {title.toLowerCase()}</h2><p>Salve e o novo registro será selecionado automaticamente.</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Fechar"><X/></button></header>
      <form onSubmit={submit}>
        <div className="modal-body">{error && <div className="form-error">{error}</div>}{config.sections.map(section => <fieldset className="form-section" key={section.title}><legend>{section.title}</legend>{section.description && <p>{section.description}</p>}<div className="form-grid">{section.fields.map(field => <QuickField key={field.name} field={field} value={form[field.name]} setValue={value => setForm(current => ({ ...current, [field.name]: value }))}/>)}</div></fieldset>)}</div>
        <footer className="modal-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Voltar ao lançamento</button><button className="primary-button" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={17}/> Salvando...</> : <><Check size={17}/> Salvar e usar</>}</button></footer>
      </form>
    </section>
  </div>, document.body);
}

function QuickField({ field, value, setValue }: { field: FieldConfig; value: FormValue | undefined; setValue: (value: FormValue) => void }) {
  const className = `field ${field.full ? "full" : ""}`;
  if (field.type === "checkboxes") {
    const selected = Array.isArray(value) ? value : [];
    return <div className={`${className} checkbox-field`}><span className="field-label">{field.label}{field.required && <b>*</b>}</span><div className="checkbox-group">{field.options?.map(option => <label key={option.value} className={selected.includes(option.value) ? "checked" : ""}><input type="checkbox" checked={selected.includes(option.value)} onChange={event => setValue(event.target.checked ? [...selected, option.value] : selected.filter(item => item !== option.value))}/><span><Check size={14}/></span>{option.label}</label>)}</div></div>;
  }
  if (field.type === "textarea") return <label className={className}><span>{field.label}</span><textarea value={String(value ?? "")} onChange={event => setValue(event.target.value)} placeholder={field.placeholder}/></label>;
  if (field.type === "select") return <label className={className}><span>{field.label}{field.required && <b>*</b>}</span><select required={field.required} value={String(value ?? "")} onChange={event => setValue(event.target.value)}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  if (field.type === "money") return <label className={className}><span>{field.label}{field.required && <b>*</b>}</span><MoneyInput required={field.required} value={String(value ?? "")} onValueChange={setValue} placeholder={field.placeholder}/></label>;
  return <label className={className}><span>{field.label}{field.required && <b>*</b>}</span><input type={field.type === "email" ? "email" : field.type === "date" ? "date" : "text"} required={field.required} value={String(value ?? "")} onChange={event => setValue(event.target.value)} placeholder={field.placeholder} maxLength={field.maxLength} readOnly={field.readOnly}/></label>;
}

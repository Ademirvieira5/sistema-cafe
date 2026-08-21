"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, Edit3, LoaderCircle, Plus, Power, PowerOff, Search, SlidersHorizontal, X } from "lucide-react";
import { defaultValues, FieldConfig, ModuleConfig } from "@/lib/modules";
import { formatCpfCnpj, formatMoney } from "@/lib/format";
import { moneyFromDecimal } from "@/lib/money-input";
import { MoneyInput } from "@/components/money-input";

type FormValue = string | boolean | string[];
type FormState = Record<string, FormValue>;
type ApiRecord = Record<string, unknown> & { id: string; active: boolean; roles?: { role: string }[] };

const labels: Record<string, string> = {
  PF: "Pessoa física", PJ: "Pessoa jurídica", SUPPLIER: "Fornecedor", CUSTOMER: "Cliente", BROKER: "Corretor",
  DEPOSITOR: "Depositante", WAREHOUSE: "Armazém geral", COMPANY: "Firma / empresa",
  RURAL_PRODUCER: "Produtor rural", INDIVIDUAL: "Pessoa física", OTHER: "Outra",
  CONTROLE_FISCAL_XML: "Controle Fiscal (XML)", MANUAL: "Cadastro manual",
  INCOME: "Receita", EXPENSE: "Despesa", BOTH: "Receita e despesa",
  CHECKING: "Conta corrente", SAVINGS: "Poupança", INVESTMENT: "Investimento", CASH: "Caixa",
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function datePt(value: unknown) {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || "—";
  const [year, month, day] = raw.split("-");
  return `${day}/${month}/${year}`;
}

function displayRows(module: ModuleConfig, record: ApiRecord) {
  if (module.slug === "pessoas") {
    const roles = record.roles?.map(({ role }) => labels[role]).join(" + ") ?? "—";
    const city = [text(record.city), text(record.state)].filter(Boolean).join(" / ") || "—";
    return [text(record.legalName), labels[text(record.classification)] ?? "—", roles, formatCpfCnpj(text(record.cpfCnpj)), city, datePt(record.lastInvoiceAt)];
  }
  if (module.slug === "corretores") return [text(record.name), formatCpfCnpj(text(record.cpfCnpj)), text(record.phone) || "—", text(record.pixKey) || "—"];
  if (module.slug === "categorias") return [text(record.name), labels[text(record.type)] ?? "—", text(record.code) || "—", text(record.description) || "—"];
  return [text(record.description) || text(record.bankName), text(record.bankName), `${text(record.agency) || "—"} / ${text(record.accountNumber)}`, formatMoney(text(record.openingBalance))];
}

function headers(module: ModuleConfig) {
  if (module.slug === "pessoas") return ["Nome / razão social", "Classificação", "Relacionamento", "CPF / CNPJ", "Cidade / UF", "Última NF-e"];
  if (module.slug === "corretores") return ["Corretor", "CPF / CNPJ", "Contato", "Chave PIX"];
  if (module.slug === "categorias") return ["Categoria", "Natureza", "Código", "Descrição"];
  return ["Conta", "Banco", "Agência / conta", "Saldo inicial"];
}

function recordToForm(config: ModuleConfig, record: ApiRecord): FormState {
  const base = defaultValues(config);
  for (const key of Object.keys(base)) {
    if (key === "roles") base.roles = record.roles?.map(({ role }) => role) ?? [];
    else if (key === "openingBalance") base[key] = moneyFromDecimal(text(record[key]));
    else if (key === "source") base[key] = labels[text(record[key])] ?? text(record[key]);
    else if (typeof record[key] === "boolean") base[key] = record[key] as boolean;
    else base[key] = text(record[key]);
  }
  base.active = record.active;
  return base;
}

export function CadastroWorkspace({ config, initialSearch = "" }: { config: ModuleConfig; initialSearch?: string }) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState("ativos");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiRecord | null>(null);
  const [form, setForm] = useState<FormState>(() => defaultValues(config));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ busca: search, status });
      const response = await fetch(`/api/cadastros/${config.slug}?${params}`);
      if (!response.ok) throw new Error();
      setRecords(await response.json());
    } catch {
      setError("Não foi possível carregar os cadastros.");
    } finally {
      setLoading(false);
    }
  }, [config.slug, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    function focusSearch() {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
    window.addEventListener("cafe:focus-search", focusSearch);
    return () => window.removeEventListener("cafe:focus-search", focusSearch);
  }, []);

  useEffect(() => {
    function saveWithF2(event: KeyboardEvent) {
      if (event.key === "F2" && modalOpen && !saving) {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", saveWithF2);
    return () => window.removeEventListener("keydown", saveWithF2);
  }, [modalOpen, saving]);
  const tableHeaders = useMemo(() => headers(config), [config]);

  function openCreate() {
    setEditing(null);
    setForm(defaultValues(config));
    setError("");
    setModalOpen(true);
  }

  function openEdit(record: ApiRecord) {
    setEditing(record);
    setForm(recordToForm(config, record));
    setError("");
    setModalOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editing ? `/api/cadastros/${config.slug}/${editing.id}` : `/api/cadastros/${config.slug}`;
      const response = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) {
        const fieldMessage = result.fields ? Object.values(result.fields).flat().find(Boolean) : null;
        throw new Error(String(fieldMessage ?? result.error ?? "Não foi possível salvar."));
      }
      setModalOpen(false);
      setSuccess(editing ? "Cadastro atualizado com sucesso." : "Cadastro incluído com sucesso.");
      window.setTimeout(() => setSuccess(""), 3500);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(record: ApiRecord) {
    setError("");
    const payload = recordToForm(config, record);
    payload.active = !record.active;
    try {
      const response = await fetch(`/api/cadastros/${config.slug}/${record.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error();
      setSuccess(record.active ? "Cadastro inativado. O histórico foi preservado." : "Cadastro reativado com sucesso.");
      window.setTimeout(() => setSuccess(""), 3500);
      await load();
    } catch {
      setError("Não foi possível alterar a situação do cadastro.");
    }
  }

  async function createStandardCategories() {
    setError("");
    try {
      const response = await fetch("/api/categorias/padroes", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível criar as categorias.");
      setSuccess(result.created ? `${result.created} categorias padrão incluídas.` : "As categorias padrão já estão cadastradas.");
      window.setTimeout(() => setSuccess(""), 3500);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar as categorias."); }
  }

  function setValue(field: string, value: FormValue) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="page records-page">
      <header className="records-header">
        <div><span className="eyebrow">{config.eyebrow}</span><h1>{config.title}</h1><p className="page-subtitle">{config.description}</p></div>
        <div className="header-buttons">{config.slug === "categorias" && <button className="secondary-button" onClick={createStandardCategories}>Criar categorias padrão</button>}<button className="primary-button" onClick={openCreate}><Plus size={18} /> Novo {config.singular}</button></div>
      </header>

      {success && <div className="toast success-toast"><Check size={18} />{success}</div>}
      {error && !modalOpen && <div className="toast error-toast"><AlertCircle size={18} />{error}<button onClick={() => setError("")} aria-label="Fechar"><X size={16} /></button></div>}

      <section className="records-panel">
        <div className="records-toolbar">
          <label className="search-box"><Search size={18} /><input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite nome, documento ou código..." aria-label="Pesquisar" /><kbd>F8</kbd></label>
          <label className="status-filter"><SlidersHorizontal size={17} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por situação"><option value="ativos">Somente ativos</option><option value="inativos">Somente inativos</option><option value="todos">Todos</option></select><ChevronDown size={15} /></label>
          <span className="record-count">{records.length} {records.length === 1 ? "registro" : "registros"}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr>{tableHeaders.map((header) => <th key={header}>{header}</th>)}<th>Situação</th><th className="actions-column">Ações</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={tableHeaders.length + 2}><div className="state-box"><LoaderCircle className="spin" size={28} /><strong>Carregando cadastros...</strong></div></td></tr> : records.length === 0 ? <tr><td colSpan={tableHeaders.length + 2}><div className="state-box empty-state"><span className="empty-icon"><Search size={24} /></span><strong>Nenhum cadastro encontrado</strong><p>{search ? "Tente outro termo de pesquisa ou ajuste o filtro." : `Inclua o primeiro ${config.singular} para começar.`}</p>{!search && <button className="secondary-button" onClick={openCreate}><Plus size={17} /> Incluir agora</button>}</div></td></tr> : records.map((record) => (
                <tr key={record.id} className={!record.active ? "inactive-row" : ""}>
                  {displayRows(config, record).map((value, index) => <td key={index}>{index === 0 ? <strong>{value}</strong> : value}</td>)}
                  <td><span className={`status-badge ${record.active ? "active" : "inactive"}`}><i />{record.active ? "Ativo" : "Inativo"}</span></td>
                  <td className="row-actions"><button onClick={() => openEdit(record)} title="Editar"><Edit3 size={17} /></button><button onClick={() => toggleActive(record)} title={record.active ? "Inativar" : "Reativar"}>{record.active ? <PowerOff size={17} /> : <Power size={17} />}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <header className="modal-header"><div><span className="eyebrow">{editing ? "Editar cadastro" : "Novo cadastro"}</span><h2 id="modal-title">{editing ? `Editar ${config.singular}` : `Novo ${config.singular}`}</h2></div><button onClick={() => setModalOpen(false)} disabled={saving} aria-label="Fechar"><X size={21} /></button></header>
            <form ref={formRef} onSubmit={submit}>
              <div className="modal-body">
                {error && <div className="form-error"><AlertCircle size={17} />{error}</div>}
                {config.sections.map((section) => (
                  <fieldset key={section.title} className="form-section"><legend>{section.title}</legend>{section.description && <p>{section.description}</p>}<div className="form-grid">
                    {section.fields.map((field) => <FormField key={field.name} field={field} value={form[field.name]} setValue={(value) => setValue(field.name, value)} />)}
                  </div></fieldset>
                ))}
                {editing && <label className="active-switch"><input type="checkbox" checked={Boolean(form.active)} onChange={(event) => setValue("active", event.target.checked)} /><span><i /><strong>Cadastro ativo</strong><small>Desative sem perder o histórico ou os vínculos futuros.</small></span></label>}
              </div>
              <footer className="modal-footer"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={18} /> Salvando...</> : <><Check size={18} /> Salvar cadastro <kbd>F2</kbd></>}</button></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function FormField({ field, value, setValue }: { field: FieldConfig; value: FormValue | undefined; setValue: (value: FormValue) => void }) {
  if (field.type === "checkboxes") {
    const selected = Array.isArray(value) ? value : [];
    return <div className={`field checkbox-field ${field.full ? "full" : ""}`}><span className="field-label">{field.label}{field.required && <b>*</b>}</span><div className="checkbox-group">{field.options?.map((option) => <label key={option.value} className={selected.includes(option.value) ? "checked" : ""}><input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => setValue(event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))} /><span><Check size={15} /></span>{option.label}</label>)}</div></div>;
  }
  if (field.type === "textarea") {
    return <label className={`field ${field.full ? "full" : ""}`}><span>{field.label}{field.required && <b>*</b>}</span><textarea value={String(value ?? "")} onChange={(event) => setValue(event.target.value)} placeholder={field.placeholder} rows={3} required={field.required} /></label>;
  }
  if (field.type === "select") {
    return <label className={`field ${field.full ? "full" : ""}`}><span>{field.label}{field.required && <b>*</b>}</span><span className="select-wrap"><select value={String(value ?? "")} onChange={(event) => setValue(event.target.value)} required={field.required}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><ChevronDown size={16} /></span></label>;
  }
  if (field.type === "money") {
    return <label className={`field ${field.full ? "full" : ""}`}><span>{field.label}{field.required && <b>*</b>}</span><MoneyInput value={String(value ?? "")} onValueChange={setValue} placeholder={field.placeholder} required={field.required} /></label>;
  }
  return <label className={`field ${field.full ? "full" : ""}`}><span>{field.label}{field.required && <b>*</b>}</span><input type={field.type === "email" ? "email" : field.type === "date" ? "date" : "text"} value={String(value ?? "")} onChange={(event) => setValue(event.target.value)} placeholder={field.placeholder} required={field.required} maxLength={field.maxLength} readOnly={field.readOnly} /></label>;
}

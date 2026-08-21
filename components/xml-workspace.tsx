"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Download, FileCode2, FileUp, Link2, Plus, ReceiptText, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";

type Suggestion = { id: string; sequence: number; date: string; totalAmount: string; kilograms: string; documentCount: number; openFiscalDifference: string; openFiscalKilograms: string };
type FiscalDocument = {
  id: string; accessKey: string; documentNumber: string; series: string | null; businessType: "PURCHASE" | "SALE"; purpose: "DEAL" | "SALE_RETURN" | "PURCHASE_RETURN" | "TRANSFER" | "REVIEW"; issueDate: string;
  classificationConfidence: "CONFIRMED" | "PROBABLE" | "REVIEW"; classificationReason: string | null; operationNature: string | null;
  funrural: { detected: boolean; rate: number | null; amount: string | null; source: string | null; officialValidation: string | null };
  funruralGeneralEntryId: string | null; fiscalState: "OPEN" | "CLOSED" | "DIFFERENCE"; fiscalDifferenceAmount: string; fiscalDifferenceKilograms: string;
  partyName: string; productsAmount: string; totalAmount: string; estimatedKilograms: string | null; estimatedSacks: string | null;
  status: "PENDING" | "LINKED" | "IGNORED" | "CANCELLED"; dealId: string | null; dealSequence: number | null; adjustmentDealId: string | null; adjustmentDealSequence: number | null; adjustmentOpenDifference: string; adjustmentOpenKilograms: string; generalEntryId: string | null; generalEntryPaidAmount: string | null;
  dealFiscalDocumentCount: number; dealFiscalTotal: string; dealFiscalKilograms: string | null;
  isCoffeeDocument: boolean; generalEntryCount: number;
  items: { description: string; unit: string; quantity: number; total: number }[]; installments: { number: string; dueDate: string; amount: number }[]; suggestions: Suggestion[];
};
type ImportResult = { filename: string; ok: boolean; duplicate?: boolean; personCreated?: boolean; error?: string; document?: FiscalDocument };
type Options = { expenseCategories: { id: string; name: string; type: string }[] };

const money = (value: string | number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
const br = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const classificationLabel = (document: FiscalDocument) => document.purpose === "SALE_RETURN" ? "Devolução de venda" : document.purpose === "PURCHASE_RETURN" ? "Devolução de compra" : document.purpose === "TRANSFER" ? "Transferência" : document.purpose === "REVIEW" ? "Revisar" : document.businessType === "PURCHASE" ? "Compra" : "Venda";
const errorText = (code?: string) => ({
  XML_NFE_NOT_FOUND: "Arquivo sem uma NF-e reconhecível.", XML_ACCESS_KEY_INVALID: "Chave de acesso inválida.", XML_PARTY_INVALID: "Emitente ou destinatário incompleto.",
  XML_PARTY_DOCUMENT_MISSING: "CPF/CNPJ da pessoa principal não encontrado.", XML_DATE_INVALID: "Data da NF-e inválida.", XML_UNSAFE: "XML recusado por segurança.", XML_TOO_LARGE: "Arquivo maior que 5 MB.",
}[code || ""] || "Não foi possível importar este arquivo.");

export function XmlWorkspace({ options }: { options: Options }) {
  const router = useRouter(), inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]), [files, setFiles] = useState<File[]>([]);
  const [search, setSearch] = useState(""), [status, setStatus] = useState("ALL"), [busy, setBusy] = useState(false), [error, setError] = useState(""), [results, setResults] = useState<ImportResult[]>([]), [selectedDeals, setSelectedDeals] = useState<Record<string, string>>({});
  const [expenseCategories, setExpenseCategories] = useState<Record<string, string>>({});
  const [returnDraft, setReturnDraft] = useState<{ documentId: string; dealId: string; financialTreatment: "FISCAL_ONLY" | "REFUND_PAYABLE"; dueDate: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/xml-documentos?status=${status}&busca=${encodeURIComponent(search)}`), body = await response.json();
    if (response.ok) { setDocuments(body); setExpenseCategories((current) => Object.fromEntries(body.map((document: FiscalDocument) => [document.id, current[document.id] || options.expenseCategories[0]?.id || ""]))); } else setError(body.error || "Não foi possível carregar os XMLs.");
  }, [search, status, options.expenseCategories]);
  useEffect(() => { const timer = window.setTimeout(load, 160); return () => window.clearTimeout(timer); }, [load]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) { setFiles(Array.from(event.target.files || []).filter((file) => file.name.toLowerCase().endsWith(".xml")).slice(0, 20)); setResults([]); setError(""); }
  async function upload() {
    if (!files.length) { inputRef.current?.click(); return; }
    setBusy(true); setError(""); setResults([]);
    try {
      const form = new FormData(); files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/xml-documentos", { method: "POST", body: form }), body = await response.json();
      setResults(body.results || []);
      if (!response.ok && !body.results) { setError(body.error || "Não foi possível importar os XMLs."); return; }
      setFiles([]); if (inputRef.current) inputRef.current.value = ""; await load();
    } catch { setError("A conexão foi interrompida durante a importação. O XML pode ser enviado novamente sem duplicar."); }
    finally { setBusy(false); }
  }
  function link(documentId: string) {
    const dealId = selectedDeals[documentId]; if (!dealId) return;
    router.push(`/compras?negocio=${encodeURIComponent(dealId)}&vincularXml=${encodeURIComponent(documentId)}`);
  }
  async function registerReturn(document: FiscalDocument) {
    if (!returnDraft || returnDraft.documentId !== document.id || !returnDraft.dealId) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/xml-documentos/${document.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REGISTER_SALE_RETURN", ...returnDraft }) }), body = await response.json();
    setBusy(false); if (!response.ok) { setError(body.error || "Não foi possível registrar a devolução."); return; }
    setReturnDraft(null); await load();
  }
  async function registerExpense(document: FiscalDocument) {
    const categoryId = expenseCategories[document.id]; if (!categoryId) { setError("Selecione a categoria da despesa."); return; }
    setBusy(true); setError("");
    const response = await fetch(`/api/xml-documentos/${document.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "POST_EXPENSE", categoryId }) }), body = await response.json();
    setBusy(false); if (!response.ok) { setError(body.error || "Não foi possível criar as contas a pagar."); return; }
    await load();
  }
  async function removeXml(document: FiscalDocument) {
    if (busy || !confirm(`Excluir definitivamente a NF-e ${document.documentNumber}?\n\nO cadastro da pessoa será mantido. Esta ação remove apenas o XML sem vínculo.`)) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/xml-documentos/${document.id}`, { method: "DELETE" }), body = await response.json();
    setBusy(false); if (!response.ok) { setError(body.error || "Não foi possível excluir o XML."); return; }
    await load();
  }

  const pending = documents.filter((document) => document.fiscalState === "OPEN").length, closed = documents.filter((document) => document.fiscalState === "CLOSED").length, difference = documents.filter((document) => document.fiscalState === "DIFFERENCE").length;
  return <div className="page xml-page">
    <header className="records-header"><div><span className="eyebrow">Documentos fiscais</span><h1>Importação de XML</h1><p className="page-subtitle">Importe a NF-e e encaminhe corretamente para negócio de café, devolução ou conta a pagar.</p></div><button className="primary-button" onClick={() => inputRef.current?.click()}><Plus size={17} />Selecionar XML</button></header>
    <section className="xml-import-card">
      <div className="xml-import-heading"><span className="xml-upload-icon"><UploadCloud /></span><div><h2>Importar NF-e</h2><p>A chave de 44 dígitos impede que a mesma nota seja importada novamente.</p></div></div>
      <div className="xml-import-controls"><div className="xml-auto-classification"><CheckCircle2 size={18}/><span><b>Classificação automática</b><small>Compra, venda, devolução ou transferência — nota por nota.</small></span></div><input ref={inputRef} hidden multiple type="file" accept=".xml,application/xml,text/xml" onChange={chooseFiles} /><button className="xml-file-picker" onClick={() => inputRef.current?.click()}><FileCode2 size={18} />{files.length ? `${files.length} arquivo(s) selecionado(s)` : "Escolher arquivos XML"}</button><button className="primary-button" disabled={busy || !files.length} onClick={upload}><FileUp size={17} />{busy ? "Importando..." : "Importar e conferir"}</button></div>
      {files.length > 0 && <div className="xml-file-list">{files.map((file) => <span key={`${file.name}-${file.size}`}><FileCode2 size={14} />{file.name}</span>)}</div>}
      {results.length > 0 && <div className="xml-results">{results.map((result) => <div className={result.ok ? "ok" : "fail"} key={result.filename}>{result.ok ? <CheckCircle2 /> : <CircleAlert />}<span><b>{result.filename}</b><small>{result.ok ? result.duplicate ? `Já estava importado · ${result.document ? classificationLabel(result.document) : "sem duplicar"}.` : `${result.document ? classificationLabel(result.document) : "NF-e"} identificada automaticamente · ${result.personCreated ? "cadastro criado" : "cadastro atualizado"}.` : errorText(result.error)}</small></span></div>)}</div>}
    </section>
    <div className="purchase-summary xml-summary"><div><small>XMLs no relatório</small><strong>{documents.length}</strong></div><div><small>Em aberto</small><strong>{pending}</strong></div><div><small>Fechados</small><strong>{closed}</strong></div><div className={difference?"has-difference":""}><small>Com diferença</small><strong>{difference}</strong></div></div>
    {error && <div className="form-error">{error}</div>}
    <section className="records-panel"><div className="records-toolbar"><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, chave ou pessoa" /></label><select className="xml-status-filter" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Todos os XMLs</option><option value="OPEN">Em aberto</option><option value="CLOSED">Fechados</option><option value="DIFFERENCE">Com diferença</option><option value="PENDING">Aguardando vínculo</option><option value="LINKED">Todos os vinculados</option></select><button className="secondary-button" onClick={load}><RefreshCw size={15} />Atualizar</button></div>
      <div className="xml-document-list">
        {documents.map((document) => <article className="xml-document" key={document.id}>
          <div className="xml-document-main">
            <div className="xml-document-title">
              <span className={`business-badge ${document.purpose === "SALE_RETURN" || document.purpose === "PURCHASE_RETURN" ? "return" : document.purpose === "TRANSFER" ? "transfer" : document.purpose === "REVIEW" ? "review" : document.businessType.toLowerCase()}`}>{classificationLabel(document)}</span>
              <h3>NF-e {document.documentNumber}{document.series && <small> · Série {document.series}</small>}</h3>
              <span className={`xml-status ${document.fiscalState.toLowerCase()}`}>{document.fiscalState === "DIFFERENCE" ? "Vinculado · conferir diferença" : document.purpose === "SALE_RETURN" && document.adjustmentDealSequence != null ? `Abatida da venda #${String(document.adjustmentDealSequence).padStart(5, "0")}` : document.status === "LINKED" && document.dealSequence != null ? `Fechado · negócio #${String(document.dealSequence).padStart(5, "0")}` : document.status === "LINKED" && document.generalEntryId ? `Fechado · ${document.generalEntryCount} conta(s) a pagar` : "Em aberto · aguardando destino"}</span>
            </div>
            <strong className="xml-party">{document.partyName}</strong>
            <span className="xml-key">Chave: {document.accessKey.replace(/(\d{4})(?=\d)/g, "$1 ")}</span>
            {document.classificationReason && <p className={`xml-classification-reason ${document.classificationConfidence.toLowerCase()}`}><b>{document.classificationConfidence === "CONFIRMED" ? "Classificação confirmada" : document.classificationConfidence === "PROBABLE" ? "Classificação provável" : "Revisão necessária"}</b><span>{document.classificationReason}</span></p>}
            <div className="xml-facts"><span><small>Emissão</small><b>{br(document.issueDate)}</b></span><span><small>Itens</small><b>{document.items.length}</b></span><span><small>{document.isCoffeeDocument ? "Quantidade estimada" : "Destino sugerido"}</small><b>{document.estimatedSacks ? `${Number(document.estimatedSacks).toLocaleString("pt-BR")} sacas · ${Number(document.estimatedKilograms).toLocaleString("pt-BR")} kg` : document.businessType === "PURCHASE" && document.purpose === "DEAL" ? "Uso da empresa · despesa" : "Conferir classificação"}</b></span><span><small>Valor da NF-e</small><b>{money(document.totalAmount)}</b></span></div>
            <p className="xml-products">{document.items.slice(0, 3).map((item) => item.description).join(" · ")}{document.items.length > 3 ? ` · +${document.items.length - 3} item(ns)` : ""}</p>
            {document.funrural.detected && <p className="xml-funrural-note"><strong>Funrural identificado no XML</strong><span>{document.funrural.rate != null ? `${document.funrural.rate.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%` : "Alíquota a conferir"}{document.funrural.amount != null ? ` · ${money(document.funrural.amount)}` : " · valor a conferir"}</span>{document.funrural.officialValidation&&<small className="official-check">{document.funrural.officialValidation}</small>}<small>{document.funruralGeneralEntryId ? "Retido do produtor e somado na obrigação mensal para pagamento." : "Será descontado do produtor e lançado na obrigação mensal quando a compra for vinculada."}</small></p>}
            {document.fiscalState === "DIFFERENCE" && <p className="xml-difference-note"><strong>Diferença encontrada</strong><span>{money(document.fiscalDifferenceAmount)} · {Number(document.fiscalDifferenceKilograms).toLocaleString("pt-BR")} kg</span></p>}
            {document.status === "LINKED" && document.dealFiscalDocumentCount > 0 && <p className="xml-deal-aggregate"><strong>{document.dealFiscalDocumentCount} NF-e(s) somada(s) no negócio</strong><span>{document.dealFiscalKilograms ? `${(Number(document.dealFiscalKilograms) / 60).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} sacas · ${Number(document.dealFiscalKilograms).toLocaleString("pt-BR")} kg · ` : ""}{money(document.dealFiscalTotal)}</span></p>}
            {document.purpose === "SALE_RETURN" && document.status === "LINKED" && <p className="xml-return-note"><b>{Number(document.adjustmentOpenDifference) <= 0 && Number(document.adjustmentOpenKilograms) <= 0 ? "Ajuste fiscal concluído" : `Ainda em aberto: ${money(document.adjustmentOpenDifference)} · ${Number(document.adjustmentOpenKilograms).toLocaleString("pt-BR")} kg`}</b>{document.generalEntryId ? " · Conta a devolver criada." : " · Sem gerar novo pagamento."}</p>}
          </div>
          <div className="xml-document-actions">
            <a className="secondary-button" href={`/api/xml-documentos/${document.id}/arquivo`}><Download size={15} />Baixar original</a>
            {document.funruralGeneralEntryId && <button className="secondary-button funrural-link" onClick={() => router.push("/contas-gerais")}><Link2 size={15}/>Ver Funrural acumulado</button>}
            {document.generalEntryId ? <button className="primary-button" onClick={() => router.push("/contas-gerais")}><Link2 size={15} />Abrir {document.generalEntryCount} conta(s) a pagar</button> : document.status === "PENDING" && document.purpose === "SALE_RETURN" ? <div className="xml-return-confirm"><strong>Abater devolução da venda</strong><p>Vincule à venda original para reduzir a diferença de peso e valor.</p><label><span>Venda com diferença em aberto</span><select value={returnDraft?.documentId === document.id ? returnDraft.dealId : ""} onChange={(event) => setReturnDraft({ documentId: document.id, dealId: event.target.value, financialTreatment: returnDraft?.documentId === document.id ? returnDraft.financialTreatment : "FISCAL_ONLY", dueDate: returnDraft?.documentId === document.id ? returnDraft.dueDate : document.issueDate })}><option value="">Selecione a venda</option>{document.suggestions.map((suggestion) => <option key={suggestion.id} value={suggestion.id}>#{String(suggestion.sequence).padStart(5,"0")} · falta {Number(suggestion.openFiscalKilograms).toLocaleString("pt-BR")} kg · {money(suggestion.openFiscalDifference)}</option>)}</select></label><label><span>Tratamento financeiro</span><select value={returnDraft?.documentId === document.id ? returnDraft.financialTreatment : "FISCAL_ONLY"} onChange={(event) => setReturnDraft({ documentId: document.id, dealId: returnDraft?.documentId === document.id ? returnDraft.dealId : "", financialTreatment: event.target.value as "FISCAL_ONLY" | "REFUND_PAYABLE", dueDate: returnDraft?.documentId === document.id ? returnDraft.dueDate : document.issueDate })}><option value="FISCAL_ONLY">Somente ajuste fiscal — cliente pagou o líquido</option><option value="REFUND_PAYABLE">Criar valor a devolver — cliente pagou o total</option></select></label>{returnDraft?.documentId === document.id && returnDraft.financialTreatment === "REFUND_PAYABLE" && <label><span>Vencimento da devolução</span><input type="date" value={returnDraft.dueDate} onChange={(event) => setReturnDraft({ ...returnDraft, dueDate:event.target.value })}/></label>}<button className="return-button" disabled={busy || !returnDraft?.dealId || (returnDraft.financialTreatment === "REFUND_PAYABLE" && !returnDraft.dueDate)} onClick={() => registerReturn(document)}>{busy ? "Vinculando..." : "Vincular devolução e abater"}</button></div> : document.status === "PENDING" && document.purpose === "DEAL" && document.businessType === "PURCHASE" && !document.isCoffeeDocument ? <div className="xml-expense-confirm"><header><ReceiptText size={18}/><span><strong>Compra para uso da empresa</strong><small>{document.installments.length} parcela(s) encontrada(s) no XML</small></span></header><div className="xml-expense-installments">{document.installments.map((part, index) => <span key={`${part.number}-${index}`}><b>{index + 1}</b><small>{br(part.dueDate)}</small><strong>{money(part.amount)}</strong></span>)}</div><label><span>Categoria da despesa</span><select value={expenseCategories[document.id] || ""} onChange={(event) => setExpenseCategories((current) => ({ ...current, [document.id]: event.target.value }))}>{options.expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="primary-button" disabled={busy || !expenseCategories[document.id]} onClick={() => registerExpense(document)}>{busy ? "Criando contas..." : `Criar ${document.installments.length || 1} conta(s) a pagar`}</button></div> : document.status === "PENDING" && document.purpose === "DEAL" ? <>
              <label><span>Somar a um negócio existente</span><select value={selectedDeals[document.id] || ""} onChange={(event) => setSelectedDeals((current) => ({ ...current, [document.id]: event.target.value }))}><option value="">Selecione para vincular</option>{document.suggestions.map((suggestion) => <option key={suggestion.id} value={suggestion.id}>#{String(suggestion.sequence).padStart(5, "0")} · {br(suggestion.date)} · {money(suggestion.totalAmount)} · {Number(suggestion.kilograms).toLocaleString("pt-BR")} kg · {suggestion.documentCount} NF-e(s)</option>)}</select></label>
              <button className="secondary-button link-button" disabled={busy || !selectedDeals[document.id]} onClick={() => link(document.id)}><Link2 size={15} />Abrir negócio e conferir</button>
              <button className="primary-button" onClick={() => router.push(`/compras?xml=${document.id}`)}><Plus size={15} />Criar negócio com esta NF-e</button>
            </> : document.status === "PENDING" && <div className="xml-special-classification"><CircleAlert size={17}/><span><b>{classificationLabel(document)}</b><small>{document.purpose === "TRANSFER" ? "Não gera compra, venda ou pagamento." : document.purpose === "PURCHASE_RETURN" ? "Classificada sem criar um novo negócio; aguarda o tratamento da compra original." : "Confira a classificação antes de vincular."}</small></span></div>}
            {document.status === "PENDING" && <button className="xml-delete-button" disabled={busy} onClick={() => removeXml(document)}><Trash2 size={15}/>Excluir XML</button>}
          </div>
        </article>)}
        {!documents.length && <div className="state-box"><span className="empty-icon"><FileCode2 /></span><strong>Nenhum XML nesta seleção</strong><p>Escolha uma NF-e para iniciar a conferência fiscal.</p></div>}
      </div>
    </section>
  </div>;
}

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, FileText, Plus, Printer, RefreshCw, WalletCards, X } from "lucide-react";
import { clientOperationKey } from "@/lib/client-id";
import { MoneyInput } from "@/components/money-input";
import { moneyFromDecimal } from "@/lib/money-input";
import { QuickCreateSelect } from "@/components/quick-create-select";

type Broker = { id: string; name: string };
type Account = { id: string; bankName: string; accountNumber: string };
type Entry = { id: string; entryType: "COMMISSION" | "PAYMENT"; date: string; description: string; detail: string; dealSacks: string | null; dealPricePerSack: string | null; credit: string; debit: string; balance: string; method: string | null; document: string | null };
type Statement = { broker: Broker; summary: { credits: string; paid: string; balance: string }; entries: Entry[]; accounts: Account[] };

const empty: Statement = { broker: { id: "", name: "" }, summary: { credits: "0.00", paid: "0.00", balance: "0.00" }, entries: [], accounts: [] };
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string | number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const methods: Record<string, string> = { PIX: "PIX", TED: "TED", CHECK: "Cheque", DEBIT: "Débito", CASH: "Dinheiro", TRANSFER: "Transferência", OTHER: "Outra" };

export function BrokerStatement({ brokers, initialBrokerId = "" }: { brokers: Broker[]; initialBrokerId?: string }) {
  const [brokerId, setBrokerId] = useState(brokers.some(broker => broker.id === initialBrokerId) ? initialBrokerId : brokers[0]?.id || "");
  const [statement, setStatement] = useState<Statement>(empty);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ operationKey: clientOperationKey(), bankAccountId: "", method: "PIX", status: "CONFIRMED", amount: "", movementDate: today(), document: "", checkNumber: "", notes: "" });

  const load = useCallback(async () => {
    if (!brokerId) { setStatement(empty); return; }
    setLoading(true); setError("");
    const response = await fetch(`/api/corretores/${brokerId}/ficha`);
    const body = await response.json(); setLoading(false);
    if (!response.ok) { setError(body.error || "Não foi possível carregar a ficha."); return; }
    setStatement(body);
  }, [brokerId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  function openPayment() {
    setError("");
    setForm(current => ({ ...current, operationKey: clientOperationKey(), amount: moneyFromDecimal(statement.summary.balance), movementDate: today(), document: "", checkNumber: "", notes: "" }));
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch(`/api/corretores/${brokerId}/ficha`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setError(body.error || "Não foi possível registrar o pagamento."); return; }
    setOpen(false); await load();
  }

  return <div className="page broker-page">
    <header className="records-header"><div><span className="eyebrow">Conta-corrente de comissões</span><h1>Ficha do corretor</h1><p className="page-subtitle">Créditos pelas negociações, pagamentos realizados e saldo acumulado — sem vencimento.</p></div><div className="header-buttons"><button className="secondary-button print-button" onClick={() => window.print()}><Printer size={16}/>Imprimir / PDF</button><button className="primary-button" disabled={!brokerId || Number(statement.summary.balance) <= 0} onClick={openPayment}><Plus size={17}/>Pagar comissão</button></div></header>
    <section className="print-report-meta"><div><b>Café BH</b><span>Gestão comercial</span></div><div><b>Ficha do corretor</b><span>{statement.broker.name || "Corretor não selecionado"}</span></div></section>
    {error && !open && <div className="form-error banking-error">{error}<button onClick={() => setError("")}><X size={15}/></button></div>}
    <div className="statement-filter"><QuickCreateSelect label="Corretor" createLabel="corretor" module="corretores" value={brokerId} onChange={setBrokerId} options={brokers.map(broker => ({ id: broker.id, label: broker.name }))}/><span className="statement-rule"><WalletCards size={17}/>Conta-corrente sem data de vencimento</span></div>
    <section className="broker-summary"><article><ArrowDownToLine/><span>Comissões geradas<strong>{money(statement.summary.credits)}</strong></span></article><article><ArrowUpFromLine/><span>Total pago<strong>{money(statement.summary.paid)}</strong></span></article><article className="broker-balance"><WalletCards/><span>Saldo a pagar<strong>{money(statement.summary.balance)}</strong></span></article></section>
    <section className="records-panel"><div className="table-wrap"><table><thead><tr><th>Data</th><th>Movimento</th><th>Origem / conta</th><th>Documento</th><th>Crédito</th><th>Débito</th><th>Saldo</th></tr></thead><tbody>{statement.entries.map(entry => <tr key={`${entry.entryType}-${entry.id}`}><td>{date(entry.date)}</td><td><span className={`ledger-type ${entry.entryType === "COMMISSION" ? "credit" : "debit"}`}>{entry.entryType === "COMMISSION" ? "Comissão" : "Pagamento"}</span><strong>{entry.description}</strong></td><td><span className="broker-origin">{entry.detail}</span>{entry.entryType === "COMMISSION" && entry.dealSacks && entry.dealPricePerSack && <small className="broker-deal-summary"><b>{Number(entry.dealSacks).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} sacas</b><i>×</i><b>{money(entry.dealPricePerSack)} por saca</b></small>}{entry.method && <small>{methods[entry.method] || entry.method}</small>}</td><td>{entry.document || "—"}</td><td className="amount-in">{Number(entry.credit) ? money(entry.credit) : "—"}</td><td className="amount-out">{Number(entry.debit) ? money(entry.debit) : "—"}</td><td><strong>{money(entry.balance)}</strong></td></tr>)}</tbody></table>{loading && <div className="state-box"><RefreshCw className="spin"/><strong>Atualizando ficha...</strong></div>}{!loading && !statement.entries.length && <div className="state-box"><span className="empty-icon"><FileText/></span><strong>Nenhum movimento nesta ficha</strong><p>As negociações com comissão aparecerão automaticamente aqui.</p></div>}</div></section>
    {open && <div className="modal-layer"><div className="form-modal settlement-modal"><div className="modal-header"><div><span className="eyebrow">Débito na conta-corrente</span><h2>Pagar comissão</h2><p>{statement.broker.name}</p></div><button onClick={() => setOpen(false)} aria-label="Fechar"><X/></button></div><form onSubmit={submit}><div className="modal-body">{error && <div className="form-error">{error}</div>}<div className="settlement-balance"><span>Saldo disponível para pagamento</span><strong>{money(statement.summary.balance)}</strong></div><fieldset className="form-section"><legend>Movimentação bancária</legend><div className="form-grid"><QuickCreateSelect label="Conta bancária" createLabel="conta bancária" module="contas" required value={form.bankAccountId} onChange={bankAccountId => setForm({ ...form, bankAccountId })} options={statement.accounts.map(account => ({ id: account.id, label: account.bankName+" · "+account.accountNumber }))}/><label className="field"><span>Forma <b>*</b></span><select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>{Object.entries(methods).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label className="field"><span>Data do pagamento <b>*</b></span><input type="date" required value={form.movementDate} onChange={e => setForm({ ...form, movementDate: e.target.value })}/></label><label className="field"><span>Valor pago <b>*</b></span><MoneyInput required value={form.amount} onValueChange={amount => setForm({ ...form, amount })}/></label><label className="field"><span>Situação</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="CONFIRMED">Confirmado</option><option value="CLEARED">Compensado</option></select></label><label className="field"><span>Documento / referência</span><input value={form.document} onChange={e => setForm({ ...form, document: e.target.value })}/></label>{form.method === "CHECK" && <label className="field"><span>Número do cheque</span><input value={form.checkNumber} onChange={e => setForm({ ...form, checkNumber: e.target.value })}/></label>}<label className="field full"><span>Observações</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label></div></fieldset></div><div className="modal-footer"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" disabled={busy || !form.bankAccountId}>{busy ? "Registrando..." : "Confirmar pagamento"}</button></div></form></div></div>}
  </div>;
}

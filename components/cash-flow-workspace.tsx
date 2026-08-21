"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronDown, ChevronUp, Landmark, RefreshCw, WalletCards } from "lucide-react";

type Entry = { direction: "IN" | "OUT"; amount: string; bankName: string; accountNumber: string; counterparty: string; description: string; status: string };
type Day = { date: string; opening: string; incoming: string; outgoing: string; closing: string; entries: Entry[] };
type Account = { id: string; bankName: string; accountNumber: string };

const today = () => new Date().toISOString().slice(0, 10);
const ahead = () => { const date = new Date(); date.setDate(date.getDate() + 30); return date.toISOString().slice(0, 10) };
const brl = (value: string | number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
const dateValue = (value: string) => new Date(`${value}T12:00:00`);
const displayDate = (value: string) => dateValue(value).toLocaleDateString("pt-BR");
const weekday = (value: string) => dateValue(value).toLocaleDateString("pt-BR", { weekday: "long" });
const statusLabels: Record<string, string> = { PLANNED: "Previsto", CONFIRMED: "Confirmado", CLEARED: "Compensado", CANCELLED: "Cancelado" };
const statusLabel = (value: string) => statusLabels[value] || value;

export function CashFlowWorkspace() {
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(ahead());
  const [account, setAccount] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ inicio: start, fim: end });
    if (account) params.set("conta", account);
    const response = await fetch(`/api/fluxo-caixa?${params}`);
    const body = await response.json();
    setLoading(false);
    if (response.ok) { setDays(body.days); setAccounts(body.accounts) }
  }, [start, end, account]);

  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer) }, [load]);
  const total = useMemo(() => days.reduce((sum, day) => ({ in: sum.in + Number(day.incoming), out: sum.out + Number(day.outgoing) }), { in: 0, out: 0 }), [days]);
  const variation = total.in - total.out;

  return (
    <div className="page cashflow-page">
      <header className="records-header"><div><span className="eyebrow">Planejamento financeiro</span><h1>Fluxo de caixa diário</h1><p className="page-subtitle">Saldo inicial, entradas, saídas e projeção por dia.</p></div></header>

      <section className="cashflow-summary">
        <article className="cashflow-summary-card incoming"><span className="cashflow-summary-icon"><ArrowDownLeft /></span><span>Entradas do período<strong>{brl(total.in)}</strong><small>Recebimentos previstos</small></span></article>
        <article className="cashflow-summary-card outgoing"><span className="cashflow-summary-icon"><ArrowUpRight /></span><span>Saídas do período<strong>{brl(total.out)}</strong><small>Pagamentos previstos</small></span></article>
        <article className="cashflow-summary-card balance"><span className="cashflow-summary-icon"><WalletCards /></span><span>Saldo projetado final<strong>{brl(days.at(-1)?.closing || "0")}</strong><small className={variation >= 0 ? "positive" : "negative"}>{variation >= 0 ? "+" : ""}{brl(variation)} no período</small></span></article>
      </section>

      <section className="records-panel cashflow-panel">
        <div className="records-toolbar cashflow-toolbar">
          <div className="cashflow-filter-title"><CalendarDays size={19} /><span><strong>Período da projeção</strong><small>Filtre os dias e a conta bancária</small></span></div>
          <label className="field"><small>Início</small><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label className="field"><small>Fim</small><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          <label className="status-filter cashflow-account-filter"><Landmark size={16} /><select value={account} onChange={(event) => setAccount(event.target.value)}><option value="">Todas as contas</option>{accounts.map((item) => <option value={item.id} key={item.id}>{item.bankName} · {item.accountNumber}</option>)}</select><ChevronDown size={15} /></label>
        </div>

        <div className="table-wrap cashflow-table">
          <table>
            <thead><tr><th>Data</th><th>Saldo inicial</th><th>Entradas</th><th>Saídas</th><th>Saldo final</th><th>Ações</th></tr></thead>
            <tbody>
              {days.map((day) => {
                const expanded = open === day.date;
                const dailyVariation = Number(day.incoming) - Number(day.outgoing);
                const incomingEntries = day.entries.filter((entry) => entry.direction === "IN");
                const outgoingEntries = day.entries.filter((entry) => entry.direction === "OUT");
                return (
                  <Fragment key={day.date}>
                    <tr className={`${day.entries.length ? "cashflow-active" : ""} ${expanded ? "is-open" : ""}`}>
                      <td><span className="cashflow-date"><strong>{displayDate(day.date)}</strong><small>{weekday(day.date)}</small></span></td>
                      <td>{brl(day.opening)}</td>
                      <td><span className="cashflow-amount incoming"><ArrowDownLeft size={15} /><strong>{brl(day.incoming)}</strong></span></td>
                      <td><span className="cashflow-amount outgoing"><ArrowUpRight size={15} /><strong>{brl(day.outgoing)}</strong></span></td>
                      <td><span className="cashflow-closing"><strong>{brl(day.closing)}</strong><small className={dailyVariation >= 0 ? "positive" : "negative"}>{dailyVariation >= 0 ? "+" : ""}{brl(dailyVariation)}</small></span></td>
                      <td>{day.entries.length > 0 && <button className={`cashflow-toggle ${expanded ? "is-open" : ""}`} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : day.date)}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}<span>{expanded ? "Fechar" : "Ver lançamentos"}</span><b>{day.entries.length}</b></button>}</td>
                    </tr>
                    {expanded && <tr className="cashflow-details"><td colSpan={6}><div className="cashflow-detail-panel">
                      <header className="cashflow-detail-head"><div><span>Lançamentos do dia</span><strong>{displayDate(day.date)} · {day.entries.length} {day.entries.length === 1 ? "lançamento" : "lançamentos"}</strong></div><div className="cashflow-detail-totals"><span className="incoming">Entradas <b>{brl(incomingEntries.reduce((sum, entry) => sum + Number(entry.amount), 0))}</b></span><span className="outgoing">Saídas <b>{brl(outgoingEntries.reduce((sum, entry) => sum + Number(entry.amount), 0))}</b></span></div></header>
                      <div className="cashflow-entry-list">{day.entries.map((entry, index) => { const incoming = entry.direction === "IN"; return <article className={`cashflow-entry-card ${incoming ? "incoming" : "outgoing"}`} key={`${entry.description}-${index}`}><span className="cashflow-entry-icon">{incoming ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><div className="cashflow-entry-copy"><span className="cashflow-entry-type">{incoming ? "Entrada" : "Saída"}</span><strong>{entry.description || "Lançamento sem descrição"}</strong><small>{entry.counterparty || "Sem favorecido informado"}</small></div><div className="cashflow-entry-meta"><strong>{incoming ? "+" : "−"} {brl(entry.amount)}</strong><span><Landmark size={13} />{entry.bankName} · {entry.accountNumber}</span><small>{statusLabel(entry.status)}</small></div></article> })}</div>
                    </div></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {loading && <div className="state-box"><RefreshCw className="spin" /><strong>Calculando fluxo...</strong></div>}
          {!loading && days.length === 0 && <div className="state-box"><CalendarDays /><strong>Nenhum dia encontrado neste período.</strong></div>}
        </div>
      </section>
    </div>
  );
}

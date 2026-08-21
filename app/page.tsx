"use client";

import Link from "next/link";
import {
  ArrowRight, Building2, CalendarDays, CheckCircle2, CircleDollarSign, Clock3,
  Handshake, Landmark, Plus, Search, ShieldCheck, ShoppingCart, Tags, TrendingUp,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PendingPanel } from "@/components/pending-panel";

const modules = [
  { href: "/cadastros/pessoas", key: "pessoas", label: "Pessoas e empresas", hint: "Fornecedores e clientes", icon: Building2, color: "emerald" },
  { href: "/cadastros/corretores", key: "corretores", label: "Corretores", hint: "Intermediação comercial", icon: Handshake, color: "copper" },
  { href: "/cadastros/categorias", key: "categorias", label: "Categorias", hint: "Receitas e despesas", icon: Tags, color: "blue" },
  { href: "/cadastros/contas", key: "contas", label: "Contas bancárias", hint: "Base da tesouraria", icon: Landmark, color: "violet" },
] as const;

type Counts = Record<(typeof modules)[number]["key"], number | null>;

export default function Home() {
  const [counts, setCounts] = useState<Counts>({ pessoas: null, corretores: null, categorias: null, contas: null });
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());

  useEffect(() => {
    Promise.all(modules.map(async (module) => {
      const response = await fetch(`/api/cadastros/${module.key}?status=todos&busca=`);
      if (!response.ok) throw new Error();
      const records = await response.json();
      return [module.key, records.length] as const;
    })).then((entries) => setCounts(Object.fromEntries(entries) as Counts)).catch(() => undefined);
  }, []);

  return (
    <div className="page dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Central de operação</span>
          <h1>Bom trabalho, Ademir.</h1>
          <p className="page-subtitle">Tudo que importa para a operação do café, organizado em um único lugar.</p>
        </div>
        <div className="dashboard-header-actions">
          <span className="date-chip"><CalendarDays size={16} />{today}</span>
          <button className="search-trigger" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "F8" }))}><Search size={16} /> Localizar cadastro <kbd>F8</kbd></button>
        </div>
      </header>

      <section className="dashboard-status">
        <div className="status-copy">
          <span className="status-pill"><span className="pulse" /> Negócios e mapa diário ativos</span>
          <h2>Compra, venda e financeiro em um fluxo simples e direto.</h2>
          <p>Registre negócios de café, acompanhe vencimentos e visualize o mapa diário sem sair da mesma operação.</p>
          <div className="status-actions">
            <Link href="/compras" className="primary-button"><Plus size={17} /> Novo negócio</Link>
            <Link href="/relatorios" className="secondary-button"><TrendingUp size={16} /> Abrir mapa diário</Link>
          </div>
          <div className="trust-row"><span><ShieldCheck size={15} /> Histórico ativo</span><span><CheckCircle2 size={15} /> Dados no próprio Site</span><span><Clock3 size={15} /> Resposta imediata</span></div>
        </div>

        <div className="operation-preview">
          <div className="preview-heading"><div><span className="eyebrow">Visão operacional</span><h3>Pulso financeiro diário</h3></div><span className="preview-badge">Em operação</span></div>
          <div className="cashflow-visual">
            <div className="cashflow-line"><i style={{ height: "31%" }} /><i style={{ height: "46%" }} /><i style={{ height: "38%" }} /><i style={{ height: "63%" }} /><i style={{ height: "54%" }} /><i style={{ height: "76%" }} /><i className="copper-bar" style={{ height: "88%" }} /></div>
            <div className="cashflow-legend"><span><i className="legend-green" /> Movimento projetado</span><strong>Visão por dia</strong></div>
          </div>
          <div className="preview-metrics">
            <span><small>Entradas</small><strong>Vendas e recebimentos</strong></span>
            <span><small>Saídas</small><strong>Compras e pagamentos</strong></span>
            <span><small>Consolidado</small><strong>Mapa por vencimento</strong></span>
          </div>
        </div>
      </section>

      <PendingPanel />

      <section className="workspace-section">
        <div className="section-heading compact-heading"><div><span className="eyebrow">Base operacional</span><h2>Acessos do dia a dia</h2></div><span className="secure-note"><ShieldCheck size={16} /> Dados preservados automaticamente</span></div>
        <div className="module-grid compact-module-grid">
          {modules.map(({ href, key, label, hint, icon: Icon, color }) => (
            <Link href={href} className="module-card compact-module-card" key={href}>
              <span className={`module-icon ${color}`}><Icon size={20} /></span>
              <div className="module-summary"><small>{hint}</small><h3>{label}</h3></div>
              <span className="module-count">{counts[key] === null ? "—" : counts[key]}<small>registros</small></span>
              <ArrowRight className="module-arrow" size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section className="daily-strip">
        <div className="daily-strip-title"><span className="strip-icon"><TrendingUp size={19} /></span><div><strong>Operação diária</strong><small>Fluxo compacto desenhado para trabalhar sem rolagem excessiva</small></div></div>
        <div className="daily-actions">
          <Link href="/compras"><ShoppingCart size={17} /><b>Novo negócio</b><small>Compra ou venda</small></Link>
          <Link href="/contas-gerais"><CircleDollarSign size={17} /><b>Conta geral</b><small>Pagar ou receber</small></Link>
          <Link href="/bancos"><Landmark size={17} /><b>Tesouraria</b><small>Saldos e conciliação</small></Link>
          <Link href="/relatorios"><WalletCards size={17} /><b>Mapa diário</b><small>Visão consolidada</small></Link>
        </div>
      </section>
    </div>
  );
}

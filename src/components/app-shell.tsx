"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChartNoAxesCombined, ChevronRight, CircleDollarSign, Coffee, FileText, Handshake, Landmark, LayoutDashboard, Menu, Tags, Users, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/cadastros/pessoas", label: "Fornecedores e clientes", icon: Building2 },
  { href: "/cadastros/corretores", label: "Corretores", icon: Handshake },
  { href: "/cadastros/categorias", label: "Categorias financeiras", icon: Tags },
  { href: "/cadastros/contas", label: "Contas bancárias", icon: Landmark },
  { href: "/compras", label: "Compras de café", icon: Coffee },
  { href: "/corretores/ficha", label: "Ficha dos corretores", icon: FileText },
];

const future = [
  { label: "Vendas", icon: Coffee },
  { label: "Financeiro", icon: CircleDollarSign },
  { label: "Relatórios", icon: ChartNoAxesCombined },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button>
      {open && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="brand-row">
          <Link href="/" className="brand" onClick={() => setOpen(false)}>
            <span className="brand-mark"><Coffee size={22} /></span>
            <span><strong>Café BH</strong><small>Gestão comercial</small></span>
          </Link>
          <button className="close-menu" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <nav aria-label="Navegação principal">
          <span className="nav-label">Operação</span>
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`} onClick={() => setOpen(false)}><Icon size={19} /><span>{label}</span>{active && <ChevronRight className="nav-arrow" size={16} />}</Link>;
          })}
          <span className="nav-label nav-label-spaced">Próximas etapas</span>
          {future.map(({ label, icon: Icon }) => <span className="nav-item disabled" key={label}><Icon size={19} /><span>{label}</span><small>Em breve</small></span>)}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar"><Users size={17} /></span>
          <span><strong>Ambiente principal</strong><small>Etapa 1 · Cadastros</small></span>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2, ChevronDown, ChevronRight, CircleDollarSign, Coffee,
  Command, Handshake, Landmark, LayoutDashboard,
  Maximize2, Menu, Minus, PackageSearch, Search, ShoppingCart, Tags, Users,
  WalletCards, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const navigation = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/cadastros/pessoas", label: "Pessoas e empresas", icon: Building2 },
  { href: "/cadastros/corretores", label: "Corretores", icon: Handshake },
  { href: "/cadastros/categorias", label: "Categorias", icon: Tags },
  { href: "/cadastros/contas", label: "Contas bancárias", icon: Landmark },
];

const operationPreview = [
  { label: "Compras", icon: ShoppingCart },
  { label: "Pagamentos", icon: WalletCards },
  { label: "Vendas", icon: PackageSearch },
  { label: "Financeiro", icon: CircleDollarSign },
];

type MenuEntry = { label: string; href?: string; shortcut?: string; disabled?: boolean; action?: "reload" | "close" | "commands" };
type MenuGroup = { label: string; entries: MenuEntry[] };

const menus: MenuGroup[] = [
  { label: "Arquivo", entries: [
    { label: "Visão geral", href: "/", shortcut: "Início" },
    { label: "Busca rápida", action: "commands", shortcut: "Ctrl+K" },
    { label: "Recarregar", action: "reload", shortcut: "Ctrl+R" },
    { label: "Sair", action: "close", shortcut: "Alt+F4" },
  ] },
  { label: "Cadastros", entries: navigation.slice(1).map(({ href, label }) => ({ label, href })) },
  { label: "Operações", entries: [
    { label: "Compras de café", disabled: true, shortcut: "Próxima etapa" },
    { label: "Pagamentos", disabled: true },
    { label: "Vendas de café", disabled: true },
    { label: "Recebimentos", disabled: true },
  ] },
  { label: "Relatórios", entries: [
    { label: "Compras e vendas", disabled: true },
    { label: "Fluxo financeiro", disabled: true },
    { label: "Apuração de resultado", disabled: true },
  ] },
  { label: "Ajuda", entries: [
    { label: "Atalhos e comandos", action: "commands", shortcut: "F8" },
    { label: "Sistema Café BH · Etapa 1", disabled: true },
  ] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const titlebarRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsDesktop(Boolean(window.desktop?.isElectron)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "F8") {
        event.preventDefault();
        if (pathname.startsWith("/cadastros/")) {
          window.dispatchEvent(new CustomEvent("cafe:focus-search"));
        } else {
          setPaletteOpen(true);
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") {
        setActiveMenu(null);
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname]);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!titlebarRef.current?.contains(event.target as Node)) setActiveMenu(null);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const commands = useMemo(() => [
    ...navigation.map(({ href, label, icon }) => ({ href, label, icon, group: href === "/" ? "Navegação" : "Cadastros" })),
  ].filter((command) => command.label.toLowerCase().includes(paletteQuery.toLowerCase().trim())), [paletteQuery]);

  function runMenuEntry(entry: MenuEntry) {
    setActiveMenu(null);
    if (entry.disabled) return;
    if (entry.href) router.push(entry.href);
    if (entry.action === "reload") window.location.reload();
    if (entry.action === "close") window.desktop?.close();
    if (entry.action === "commands") setPaletteOpen(true);
  }

  function goToCommand(href: string) {
    setPaletteOpen(false);
    setPaletteQuery("");
    router.push(href);
  }

  return (
    <div className="app-shell">
      <div className="desktop-titlebar" ref={titlebarRef}>
        <Link href="/" className="titlebar-brand" title="Sistema Café BH">
          <span className="titlebar-mark"><Coffee size={16} /></span>
          <strong>Sistema Café</strong>
        </Link>
        <div className="desktop-menus" role="menubar" aria-label="Menu do aplicativo">
          {menus.map((menu) => (
            <div className="desktop-menu" key={menu.label}>
              <button className={activeMenu === menu.label ? "is-active" : ""} onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}>
                {menu.label}<ChevronDown size={12} />
              </button>
              {activeMenu === menu.label && (
                <div className="desktop-dropdown" role="menu">
                  {menu.entries.map((entry) => (
                    <button key={entry.label} disabled={entry.disabled} onClick={() => runMenuEntry(entry)} role="menuitem">
                      <span>{entry.label}</span>{entry.shortcut && <kbd>{entry.shortcut}</kbd>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="titlebar-context"><span className="connection-dot" /> Banco local protegido</div>
        {isDesktop && (
          <div className="window-controls">
            <button onClick={() => window.desktop?.minimize()} aria-label="Minimizar"><Minus size={16} /></button>
            <button onClick={() => window.desktop?.maximize()} aria-label="Maximizar"><Maximize2 size={14} /></button>
            <button className="window-close" onClick={() => window.desktop?.close()} aria-label="Fechar"><X size={17} /></button>
          </div>
        )}
      </div>

      <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button>
      {sidebarOpen && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="brand-row sidebar-brand-row">
          <Link href="/" className="brand" onClick={() => setSidebarOpen(false)}>
            <span className="brand-mark"><Coffee size={21} /></span>
            <span><strong>Café BH</strong><small>Gestão comercial</small></span>
          </Link>
          <button className="close-menu" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>

        <button className="quick-search" onClick={() => setPaletteOpen(true)}>
          <Search size={16} /><span>Busca rápida</span><kbd>F8</kbd>
        </button>

        <nav aria-label="Navegação principal">
          <span className="nav-label">Principal</span>
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`} onClick={() => setSidebarOpen(false)}><Icon size={18} /><span>{label}</span>{active && <ChevronRight className="nav-arrow" size={15} />}</Link>;
          })}
          <span className="nav-label nav-label-spaced">Operação diária</span>
          {operationPreview.map(({ label, icon: Icon }) => <span className="nav-item disabled" key={label}><Icon size={18} /><span>{label}</span><small>Em breve</small></span>)}
        </nav>

        <div className="sidebar-footer">
          <span className="avatar"><Users size={17} /></span>
          <span><strong>Ambiente principal</strong><small>Desktop · Banco local</small></span>
        </div>
      </aside>

      <main className="main-content">{children}</main>

      {paletteOpen && (
        <div className="command-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-label="Busca rápida">
            <div className="command-input"><Search size={20} /><input autoFocus value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Digite o que deseja abrir..." /><kbd>ESC</kbd></div>
            <div className="command-results">
              <span className="command-label">Acesso rápido</span>
              {commands.map(({ href, label, icon: Icon, group }) => (
                <button key={href} onClick={() => goToCommand(href)}><span className="command-icon"><Icon size={18} /></span><span><strong>{label}</strong><small>{group}</small></span><ChevronRight size={16} /></button>
              ))}
              {commands.length === 0 && <div className="command-empty"><Command size={24} /><span>Nenhuma opção encontrada.</span></div>}
            </div>
            <footer className="command-footer"><span><kbd>↑↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>F8</kbd> pesquisar cadastros</span></footer>
          </section>
        </div>
      )}
    </div>
  );
}



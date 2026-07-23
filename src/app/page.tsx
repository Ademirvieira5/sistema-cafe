import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, Handshake, Landmark, ShieldCheck, Tags, WalletCards } from "lucide-react";

const cards = [
  { href: "/cadastros/pessoas", title: "Fornecedores e clientes", description: "Cadastre e organize seus parceiros comerciais.", icon: Building2, accent: "emerald" },
  { href: "/cadastros/corretores", title: "Corretores", description: "Mantenha contatos e dados de pagamento.", icon: Handshake, accent: "copper" },
  { href: "/cadastros/categorias", title: "Categorias financeiras", description: "Prepare a classificação de receitas e despesas.", icon: Tags, accent: "blue" },
  { href: "/cadastros/contas", title: "Contas bancárias", description: "Cadastre bancos, agências, contas e saldo inicial.", icon: Landmark, accent: "violet" },
];

export default function Home() {
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  return (
    <div className="page home-page">
      <header className="topbar">
        <div><span className="eyebrow">Visão geral</span><h1>Bom trabalho, Ademir.</h1><p className="page-subtitle">Sua base de gestão do café começa por cadastros confiáveis.</p></div>
        <div className="date-chip"><CalendarDays size={17} /><span>{today}</span></div>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="status-pill"><span className="pulse" /> Etapa 2 em operação</span>
          <h2>A estrutura certa para o movimento diário do seu negócio.</h2>
          <p>Fornecedores, clientes, corretores, categorias e contas bancárias reunidos em uma base segura e preparada para as próximas etapas.</p>
          <Link href="/compras" className="primary-button">Registrar uma compra <ArrowRight size={18} /></Link>
        </div>
        <div className="flow-preview" aria-label="Prévia do fluxo financeiro futuro">
          <div className="flow-heading"><span><WalletCards size={18} /> Fluxo financeiro</span><small>Próxima etapa</small></div>
          <div className="flow-empty"><div className="mini-chart"><i /><i /><i /><i /><i /><i /><i /></div><strong>Saldo diário em preparação</strong><span>O painel ganhará entradas, saídas e saldo projetado quando o módulo financeiro for autorizado.</span></div>
        </div>
      </section>

      <section className="section-heading"><div><span className="eyebrow">Cadastros essenciais</span><h2>Organize a base da operação</h2></div><span className="secure-note"><ShieldCheck size={17} /> Histórico de alterações ativo</span></section>
      <div className="module-grid">
        {cards.map(({ href, title, description, icon: Icon, accent }) => (
          <Link href={href} className="module-card" key={href}>
            <span className={`module-icon ${accent}`}><Icon size={22} /></span>
            <div><h3>{title}</h3><p>{description}</p></div>
            <span className="card-link">Abrir cadastro <ArrowRight size={16} /></span>
          </Link>
        ))}
      </div>
      <footer className="stage-footer"><span>02</span><div><strong>Compras de café</strong><p>Negócios, vencimentos e comissões · Baixas financeiras serão liberadas na próxima etapa.</p></div></footer>
    </div>
  );
}

import Link from "next/link";

export default function NotFound() {
  return <div className="page not-found"><span className="eyebrow">Página não encontrada</span><h1>Este caminho ainda não existe.</h1><p>Volte para a visão geral e escolha um dos módulos disponíveis nesta etapa.</p><Link href="/" className="primary-button">Voltar ao início</Link></div>;
}


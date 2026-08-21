import { notFound } from "next/navigation";
import { CadastroWorkspace } from "@/components/cadastro-workspace";
import { moduleConfigs } from "@/lib/modules";

export function generateStaticParams() {
  return Object.keys(moduleConfigs).map((modulo) => ({ modulo }));
}

export default async function CadastroPage({ params, searchParams }: { params: Promise<{ modulo: string }>; searchParams: Promise<{ busca?: string }> }) {
  const { modulo } = await params;
  const config = moduleConfigs[modulo];
  if (!config) notFound();
  return <CadastroWorkspace config={config} initialSearch={(await searchParams).busca ?? ""} />;
}


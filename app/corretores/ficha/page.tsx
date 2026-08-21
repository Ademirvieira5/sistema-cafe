import { BrokerStatement } from "@/components/broker-statement";
import { purchaseOptions } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function FichaCorretorPage({ searchParams }: { searchParams: Promise<{ corretor?: string }> }) {
  return <BrokerStatement brokers={(await purchaseOptions()).brokers} initialBrokerId={(await searchParams).corretor} />;
}

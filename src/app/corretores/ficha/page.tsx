import { BrokerStatement } from "@/components/broker-statement";
import { purchaseOptions } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function FichaCorretorPage() { return <BrokerStatement brokers={(await purchaseOptions()).brokers} />; }

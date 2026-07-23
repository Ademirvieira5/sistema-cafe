import { PurchaseWorkspace } from "@/components/purchase-workspace";
import { purchaseOptions } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function ComprasPage() { return <PurchaseWorkspace options={await purchaseOptions()} />; }

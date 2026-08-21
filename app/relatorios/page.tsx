import { ReportsWorkspace } from "@/components/reports-workspace";
import { purchaseOptions } from "@/lib/purchases";
export const dynamic="force-dynamic";
export default async function RelatoriosPage(){const o=await purchaseOptions();return <ReportsWorkspace suppliers={o.suppliers} clients={o.clients}/>}

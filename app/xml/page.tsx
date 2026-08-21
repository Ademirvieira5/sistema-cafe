import { XmlWorkspace } from "@/components/xml-workspace";
import { fiscalDocumentOptions } from "@/lib/fiscal-documents";

export const dynamic = "force-dynamic";

export default async function XmlPage() { return <XmlWorkspace options={await fiscalDocumentOptions()} />; }

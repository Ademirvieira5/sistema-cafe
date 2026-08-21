import { apiError } from "@/lib/api-response";
import { fiscalXmlObject } from "@/lib/fiscal-documents";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { object, filename } = await fiscalXmlObject((await params).id), headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Disposition", `attachment; filename="${filename.replace(/["\\\r\n]/g, "_")}"`);
    return new Response(object.body, { headers });
  } catch (error) { return apiError(error); }
}

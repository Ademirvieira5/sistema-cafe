import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { importFiscalDocument, listFiscalDocuments } from "@/lib/fiscal-documents";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    return NextResponse.json(await listFiscalDocuments(params.get("busca")?.trim() || "", params.get("status") || "ALL"));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) return NextResponse.json({ error: "Selecione pelo menos um arquivo XML." }, { status: 400 });
    if (files.length > 20) return NextResponse.json({ error: "Importe no máximo 20 XMLs por lote." }, { status: 400 });
    const results = [];
    for (const file of files) {
      try { results.push({ filename: file.name, ok: true, ...(await importFiscalDocument(file)) }); }
      catch (error) { results.push({ filename: file.name, ok: false, error: error instanceof Error ? error.message : "XML_INVALID" }); }
    }
    return NextResponse.json({ results }, { status: results.some((result) => result.ok) ? 201 : 400 });
  } catch (error) { return apiError(error); }
}

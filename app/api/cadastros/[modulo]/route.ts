import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { createRecord, listRecords } from "@/lib/records";
import { isModuleName } from "@/lib/validation";

type Context = { params: Promise<{ modulo: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { modulo } = await context.params;
  if (!isModuleName(modulo)) return NextResponse.json({ error: "Cadastro inválido." }, { status: 404 });
  const search = request.nextUrl.searchParams.get("busca")?.trim() ?? "";
  const rawStatus = request.nextUrl.searchParams.get("status") ?? "ativos";
  const status = rawStatus === "todos" || rawStatus === "inativos" ? rawStatus : "ativos";
  try {
    return NextResponse.json(await listRecords(modulo, search, status));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  const { modulo } = await context.params;
  if (!isModuleName(modulo)) return NextResponse.json({ error: "Cadastro inválido." }, { status: 404 });
  try {
    const created = await createRecord(modulo, await request.json());
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}


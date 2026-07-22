import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { updateRecord } from "@/lib/records";
import { isModuleName } from "@/lib/validation";

type Context = { params: Promise<{ modulo: string; id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const { modulo, id } = await context.params;
  if (!isModuleName(modulo)) return NextResponse.json({ error: "Cadastro inválido." }, { status: 404 });
  try {
    return NextResponse.json(await updateRecord(modulo, id, await request.json()));
  } catch (error) {
    return apiError(error);
  }
}


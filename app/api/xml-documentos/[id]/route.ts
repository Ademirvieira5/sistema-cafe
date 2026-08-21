import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { deleteFiscalDocument, getFiscalDocument, linkFiscalDocument, registerExpenseDocument, registerSaleReturn, unlinkFiscalDocument } from "@/lib/fiscal-documents";
import { saleReturnSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try { return NextResponse.json(await getFiscalDocument((await params).id)); }
  catch (error) { return apiError(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const body = await request.json() as { action?: string; dealId?: string; categoryId?: string; financialTreatment?: string; dueDate?: string; notes?: string };
    if (body.action === "REGISTER_SALE_RETURN") {
      const data = saleReturnSchema.parse(body);
      return NextResponse.json(await registerSaleReturn((await params).id, data.dealId, data.financialTreatment, data.dueDate, data.notes));
    }
    if (body.action === "POST_EXPENSE") {
      if (!body.categoryId) return NextResponse.json({ error: "Selecione a categoria da despesa." }, { status: 400 });
      return NextResponse.json(await registerExpenseDocument((await params).id, body.categoryId));
    }
    if (!body.dealId) return NextResponse.json({ error: "Selecione o negócio que receberá a nota." }, { status: 400 });
    return NextResponse.json(await linkFiscalDocument((await params).id, body.dealId));
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const dealId = new URL(request.url).searchParams.get("dealId")?.trim();
    if (!dealId) return NextResponse.json(await deleteFiscalDocument((await params).id));
    return NextResponse.json(await unlinkFiscalDocument((await params).id, dealId));
  } catch (error) { return apiError(error); }
}

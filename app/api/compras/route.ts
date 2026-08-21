import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { createPurchase, deletePurchase, getPurchase, purchasePage, updatePurchase } from "@/lib/purchases";

export async function GET(request: NextRequest) {
  try { const params=request.nextUrl.searchParams,id=params.get("id");if(id)return NextResponse.json(await getPurchase(id));return NextResponse.json(await purchasePage(params.get("busca")?.trim()??"",params.get("situacao")??"OPEN",Number(params.get("pagina")||1),Number(params.get("porPagina")||50))); }
  catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try { return NextResponse.json(await createPurchase(await request.json()), { status: 201 }); }
  catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { id?: string };
    if (!body.id) return NextResponse.json({ error: "Negócio não informado." }, { status: 400 });
    return NextResponse.json(await updatePurchase(body.id, body));
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const id=request.nextUrl.searchParams.get("id");
    if(!id)return NextResponse.json({error:"Negócio não informado."},{status:400});
    return NextResponse.json(await deletePurchase(id));
  } catch(error){return apiError(error);}
}

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { createPurchase, listPurchases } from "@/lib/purchases";

export async function GET(request: NextRequest) {
  try { return NextResponse.json(await listPurchases(request.nextUrl.searchParams.get("busca")?.trim() ?? "")); }
  catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try { return NextResponse.json(await createPurchase(await request.json()), { status: 201 }); }
  catch (error) { return apiError(error); }
}

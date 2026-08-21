import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { cashFlow } from "@/lib/cash-flow";
export async function GET(request: NextRequest) { try { const p=request.nextUrl.searchParams; return NextResponse.json(await cashFlow(p.get("inicio"),p.get("fim"),p.get("conta"))); } catch(error) { return apiError(error); } }

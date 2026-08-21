import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { businessReport } from "@/lib/purchases";
export async function GET(request:NextRequest){const p=request.nextUrl.searchParams;const type=p.get("tipo")==="SALE"?"SALE":"PURCHASE";try{return NextResponse.json(await businessReport(type,p.get("inicio"),p.get("fim"),p.get("pessoa")))}catch(error){return apiError(error)}}

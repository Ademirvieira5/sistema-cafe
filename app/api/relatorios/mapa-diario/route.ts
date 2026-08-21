import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { dailyMap } from "@/lib/purchases";
export async function GET(request:NextRequest){const p=request.nextUrl.searchParams;try{return NextResponse.json(await dailyMap(p.get("inicio"),p.get("fim"),p.get("pessoa"),p.get("direcao")))}catch(error){return apiError(error)}}

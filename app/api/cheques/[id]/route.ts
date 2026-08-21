import { NextRequest,NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { actOnCheque,chequeHistory } from "@/lib/cheques";
type Context={params:Promise<{id:string}>};
export async function GET(_request:NextRequest,{params}:Context){try{return NextResponse.json(await chequeHistory((await params).id))}catch(error){return apiError(error)}}
export async function PATCH(request:NextRequest,{params}:Context){try{return NextResponse.json(await actOnCheque((await params).id,await request.json()))}catch(error){return apiError(error)}}

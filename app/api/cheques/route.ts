import { NextRequest,NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { chequeOptions,createChequeBatch,listCheques } from "@/lib/cheques";
export async function GET(request:NextRequest){try{const params=request.nextUrl.searchParams;if(params.get("opcoes")==="1")return NextResponse.json(await chequeOptions());return NextResponse.json(await listCheques(params.get("busca")??"",params.get("status")??""))}catch(error){return apiError(error)}}
export async function POST(request:NextRequest){try{return NextResponse.json(await createChequeBatch(await request.json()),{status:201})}catch(error){return apiError(error)}}

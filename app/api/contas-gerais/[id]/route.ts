import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { cancelGeneralEntry, updateGeneralEntry } from "@/lib/general-entries";

type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Context){try{return NextResponse.json(await updateGeneralEntry((await params).id,await request.json()))}catch(error){return apiError(error)}}
export async function DELETE(_request:Request,{params}:Context){try{return NextResponse.json(await cancelGeneralEntry((await params).id))}catch(error){return apiError(error)}}

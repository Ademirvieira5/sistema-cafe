import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { createBackup, downloadBackup, safetyStatus } from "@/lib/data-safety";

export async function GET(request:Request){try{const key=new URL(request.url).searchParams.get("download");if(!key)return NextResponse.json(await safetyStatus());const object=await downloadBackup(key);if(!object)return NextResponse.json({error:"Backup não encontrado."},{status:404});const headers=new Headers();object.writeHttpMetadata(headers);headers.set("Cache-Control","private, no-store");headers.set("Content-Disposition",`attachment; filename="${key.split("/").at(-1)}"`);return new Response(object.body,{headers})}catch(error){return apiError(error)}}
export async function POST(request:Request){try{const automatic=new URL(request.url).searchParams.get("automatic")==="1";return NextResponse.json(await createBackup(!automatic),{status:201})}catch(error){return apiError(error)}}

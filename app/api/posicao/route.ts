import { NextRequest,NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { inventoryPosition,saveInventoryClosing,saveInventorySetting } from "@/lib/inventory-position";

export async function GET(request:NextRequest){try{return NextResponse.json(await inventoryPosition(request.nextUrl.searchParams.get("mes")??new Date().toISOString().slice(0,7)))}catch(error){return apiError(error)}}
export async function PUT(request:NextRequest){try{return NextResponse.json(await saveInventorySetting(await request.json()))}catch(error){return apiError(error)}}
export async function POST(request:NextRequest){try{return NextResponse.json(await saveInventoryClosing(await request.json()))}catch(error){return apiError(error)}}

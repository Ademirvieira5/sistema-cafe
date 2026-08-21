import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { createTransfer } from "@/lib/transfers";
export async function POST(request: Request) { try { return NextResponse.json(await createTransfer(await request.json()), { status: 201 }); } catch (error) { return apiError(error); } }

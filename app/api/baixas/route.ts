import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { createCheckBatchSettlement, createSettlement } from "@/lib/settlements";
export async function POST(request: Request) { try { const body=await request.json(); return NextResponse.json(await (Array.isArray(body.checks)?createCheckBatchSettlement(body):createSettlement(body)), { status: 201 }); } catch (error) { return apiError(error); } }

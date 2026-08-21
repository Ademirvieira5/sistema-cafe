import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { brokerStatement, createBrokerCommissionPayment } from "@/lib/purchases";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await brokerStatement((await params).id)); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await createBrokerCommissionPayment((await params).id, await request.json()), { status: 201 }); }
  catch (error) { return apiError(error); }
}

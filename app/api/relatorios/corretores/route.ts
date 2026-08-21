import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { brokerBalancesReport } from "@/lib/purchases";

export async function GET() {
  try { return NextResponse.json(await brokerBalancesReport()); }
  catch (error) { return apiError(error); }
}

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { funruralReport, saveFunruralReconciliation } from "@/lib/funrural-report";

export async function GET(request: Request) {
  try { return NextResponse.json(await funruralReport(new URL(request.url).searchParams.get("competencia") || new Date().toISOString().slice(0, 7))); }
  catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try { const url = new URL(request.url); return NextResponse.json(await saveFunruralReconciliation(url.searchParams.get("competencia") || "", await request.json())); }
  catch (error) { return apiError(error); }
}

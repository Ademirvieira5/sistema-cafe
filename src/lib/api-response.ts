import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof Error && error.message === "INSTALLMENT_TOTAL") {
    return NextResponse.json({ error: "A soma dos vencimentos deve ser igual ao valor total da compra." }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Revise os campos informados.", fields: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Já existe um cadastro com esses dados." }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
    }
  }
  console.error(error);
  return NextResponse.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}

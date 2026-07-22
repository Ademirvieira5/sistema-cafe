import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { purchaseSchema } from "@/lib/validation";

const include = { supplier: true, broker: true, installments: { orderBy: { number: "asc" as const } } };

export async function purchaseOptions() {
  const [suppliers, brokers] = await Promise.all([
    prisma.person.findMany({ where: { active: true, roles: { some: { role: "SUPPLIER" } } }, orderBy: { legalName: "asc" }, select: { id: true, legalName: true } }),
    prisma.broker.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { suppliers, brokers };
}

function calculations(data: ReturnType<typeof purchaseSchema.parse>) {
  const kg = new Prisma.Decimal(data.kilograms);
  const price = new Prisma.Decimal(data.pricePerSack);
  const sacks = kg.div(60).toDecimalPlaces(3);
  const gross = sacks.mul(price).toDecimalPlaces(2);
  const total = gross.add(new Prisma.Decimal(data.adjustmentAmount)).toDecimalPlaces(2);
  const commissionValue = new Prisma.Decimal(data.commissionValue);
  const commissionPercent = data.commissionMode === "PERCENT" ? commissionValue : total.isZero() ? new Prisma.Decimal(0) : commissionValue.mul(100).div(total).toDecimalPlaces(4);
  const commissionAmount = data.commissionMode === "PERCENT" ? total.mul(commissionValue).div(100).toDecimalPlaces(2) : commissionValue.toDecimalPlaces(2);
  const installmentTotal = data.installments.reduce((sum, item) => sum.add(new Prisma.Decimal(item.amount)), new Prisma.Decimal(0)).toDecimalPlaces(2);
  if (!installmentTotal.equals(total)) throw new Error("INSTALLMENT_TOTAL");
  return { sacks, gross, total, commissionPercent, commissionAmount };
}

export async function listPurchases(search = "") {
  return prisma.purchase.findMany({
    where: search ? { OR: [{ supplier: { legalName: { contains: search } } }, { broker: { name: { contains: search } } }] } : {},
    include,
    orderBy: [{ date: "desc" }, { sequence: "desc" }],
  });
}

export async function createPurchase(input: unknown) {
  const data = purchaseSchema.parse(input); const calc = calculations(data);
  return prisma.$transaction(async (tx) => {
    const last = await tx.purchase.findFirst({ orderBy: { sequence: "desc" }, select: { sequence: true } });
    const created = await tx.purchase.create({ data: {
      sequence: (last?.sequence ?? 0) + 1, date: new Date(`${data.date}T12:00:00`), supplierId: data.supplierId,
      kilograms: data.kilograms, sacks: calc.sacks, pricePerSack: data.pricePerSack, grossAmount: calc.gross,
      adjustmentAmount: data.adjustmentAmount, totalAmount: calc.total, brokerId: data.brokerId,
      commissionPercent: data.brokerId ? calc.commissionPercent : null, commissionAmount: data.brokerId ? calc.commissionAmount : 0,
      notes: data.notes, installments: { create: data.installments.map((item, index) => ({ number: index + 1, dueDate: new Date(`${item.dueDate}T12:00:00`), amount: item.amount })) },
    }, include });
    await tx.auditLog.create({ data: { entityType: "Purchase", entityId: created.id, action: "CREATE", afterData: JSON.stringify({ sequence: created.sequence, totalAmount: created.totalAmount.toString() }) } });
    return created;
  });
}

export async function brokerStatement(brokerId: string) {
  return prisma.purchase.findMany({ where: { brokerId, status: "OPEN" }, include: { supplier: true, broker: true }, orderBy: [{ date: "desc" }, { sequence: "desc" }] });
}

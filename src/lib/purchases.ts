import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { purchaseSchema } from "@/lib/validation";

const include = { supplier: true, broker: true, installments: { orderBy: { number: "asc" as const } } };

export async function purchaseOptions() {
  const [suppliers, clients, brokers] = await Promise.all([
    prisma.person.findMany({ where: { active: true, roles: { some: { role: "SUPPLIER" } } }, orderBy: { legalName: "asc" }, select: { id: true, legalName: true } }),
    prisma.person.findMany({ where: { active: true, roles: { some: { role: "CUSTOMER" } } }, orderBy: { legalName: "asc" }, select: { id: true, legalName: true } }),
    prisma.broker.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { suppliers, clients, brokers };
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
      sequence: (last?.sequence ?? 0) + 1, businessType: data.businessType, date: new Date(`${data.date}T12:00:00`), supplierId: data.supplierId,
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

function period(start?: string | null, end?: string | null) {
  if (!start && !end) return undefined;
  return { ...(start ? { gte: new Date(`${start}T00:00:00`) } : {}), ...(end ? { lte: new Date(`${end}T23:59:59`) } : {}) };
}

export async function businessReport(type: "PURCHASE" | "SALE", start?: string | null, end?: string | null, personId?: string | null) {
  const rows = await prisma.purchase.findMany({ where: { businessType: type, status: "OPEN", ...(period(start, end) ? { date: period(start, end) } : {}), ...(personId ? { supplierId: personId } : {}) }, include: { supplier: true, broker: true }, orderBy: [{ date: "asc" }, { sequence: "asc" }] });
  const totals = rows.reduce((acc, row) => ({ kilograms: acc.kilograms.add(row.kilograms), sacks: acc.sacks.add(row.sacks), amount: acc.amount.add(row.totalAmount) }), { kilograms: new Prisma.Decimal(0), sacks: new Prisma.Decimal(0), amount: new Prisma.Decimal(0) });
  return { rows, summary: { count: rows.length, kilograms: totals.kilograms.toString(), sacks: totals.sacks.toString(), amount: totals.amount.toString(), averagePrice: totals.sacks.isZero() ? "0" : totals.amount.div(totals.sacks).toDecimalPlaces(2).toString() } };
}

export async function dailyMap(start?: string | null, end?: string | null, personId?: string | null, direction?: string | null) {
  const [installments, general] = await Promise.all([
    prisma.purchaseInstallment.findMany({ where: { ...(period(start, end) ? { dueDate: period(start, end) } : {}), ...(direction === "PAYABLE" ? { purchase: { businessType: "PURCHASE", ...(personId ? { supplierId: personId } : {}) } } : direction === "RECEIVABLE" ? { purchase: { businessType: "SALE", ...(personId ? { supplierId: personId } : {}) } } : personId ? { purchase: { supplierId: personId } } : {}) }, include: { purchase: { include: { supplier: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.generalEntry.findMany({ where: { active: true, ...(period(start, end) ? { dueDate: period(start, end) } : {}), ...(personId ? { personId } : {}), ...(direction === "PAYABLE" ? { direction: "PAYABLE" } : direction === "RECEIVABLE" ? { direction: "RECEIVABLE" } : {}) }, include: { category: true, person: true }, orderBy: { dueDate: "asc" } }),
  ]);
  type MapEntry={id:string;number:number;amount:string;paidAmount:string;origin:"CAFE"|"GENERAL";description:string;purchase:{businessType:"PURCHASE"|"SALE";sequence:number;supplier:{legalName:string}}};
  const byDay = new Map<string, { date: string; payable: Prisma.Decimal; receivable: Prisma.Decimal; entries: MapEntry[] }>();
  for (const item of installments) { const date = item.dueDate.toISOString().slice(0, 10); const day = byDay.get(date) ?? { date, payable: new Prisma.Decimal(0), receivable: new Prisma.Decimal(0), entries: [] }; const open = item.amount.sub(item.paidAmount); if (item.purchase.businessType === "PURCHASE") day.payable = day.payable.add(open); else day.receivable = day.receivable.add(open); day.entries.push({id:item.id,number:item.number,amount:item.amount.toString(),paidAmount:item.paidAmount.toString(),origin:"CAFE",description:"Café",purchase:{businessType:item.purchase.businessType,sequence:item.purchase.sequence,supplier:{legalName:item.purchase.supplier.legalName}}}); byDay.set(date, day); }
  for (const item of general) { const date = item.dueDate.toISOString().slice(0, 10); const day = byDay.get(date) ?? { date, payable: new Prisma.Decimal(0), receivable: new Prisma.Decimal(0), entries: [] }; const open = item.amount.sub(item.paidAmount); if(item.direction==="PAYABLE")day.payable=day.payable.add(open);else day.receivable=day.receivable.add(open);day.entries.push({id:item.id,number:1,amount:item.amount.toString(),paidAmount:item.paidAmount.toString(),origin:"GENERAL",description:`${item.description} · ${item.category.name}`,purchase:{businessType:item.direction==="PAYABLE"?"PURCHASE":"SALE",sequence:0,supplier:{legalName:item.person?.legalName??"Sem pessoa vinculada"}}});byDay.set(date,day); }
  let cumulative = new Prisma.Decimal(0);
  return [...byDay.values()].map(day => { const balance = day.receivable.sub(day.payable); cumulative = cumulative.add(balance); return { date: day.date, payable: day.payable.toString(), receivable: day.receivable.toString(), balance: balance.toString(), cumulative: cumulative.toString(), entries: day.entries }; });
}

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ModuleName, moduleSchemas } from "@/lib/validation";

type StatusFilter = "ativos" | "inativos" | "todos";

function activeWhere(status: StatusFilter) {
  if (status === "todos") return {};
  return { active: status === "ativos" };
}

function serialize(value: unknown) {
  return JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
}

async function audit(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string,
  action: "CREATE" | "UPDATE" | "INACTIVATE" | "ACTIVATE",
  beforeData: unknown,
  afterData: unknown,
) {
  await tx.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      beforeData: beforeData ? serialize(beforeData) : null,
      afterData: afterData ? serialize(afterData) : null,
    },
  });
}

export async function listRecords(module: ModuleName, search: string, status: StatusFilter) {
  const active = activeWhere(status);
  switch (module) {
    case "pessoas":
      return prisma.person.findMany({
        where: {
          ...active,
          ...(search ? { OR: [{ legalName: { contains: search } }, { tradeName: { contains: search } }, { cpfCnpj: { contains: search } }] } : {}),
        },
        include: { roles: true },
        orderBy: { legalName: "asc" },
      });
    case "corretores":
      return prisma.broker.findMany({
        where: {
          ...active,
          ...(search ? { OR: [{ name: { contains: search } }, { tradeName: { contains: search } }, { cpfCnpj: { contains: search } }] } : {}),
        },
        orderBy: { name: "asc" },
      });
    case "categorias":
      return prisma.financialCategory.findMany({
        where: {
          ...active,
          ...(search ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] } : {}),
        },
        orderBy: { name: "asc" },
      });
    case "contas":
      return prisma.bankAccount.findMany({
        where: {
          ...active,
          ...(search ? { OR: [{ bankName: { contains: search } }, { description: { contains: search } }, { accountNumber: { contains: search } }] } : {}),
        },
        orderBy: [{ bankName: "asc" }, { accountNumber: "asc" }],
      });
  }
}

export async function createRecord(module: ModuleName, input: unknown) {
  switch (module) {
    case "pessoas": {
      const data = moduleSchemas.pessoas.parse(input);
      return prisma.$transaction(async (tx) => {
        const created = await tx.person.create({
          data: {
            ...data,
            roles: { create: data.roles.map((role) => ({ role })) },
          },
          include: { roles: true },
        });
        await audit(tx, "Person", created.id, "CREATE", null, created);
        return created;
      });
    }
    case "corretores": {
      const data = moduleSchemas.corretores.parse(input);
      return prisma.$transaction(async (tx) => {
        const created = await tx.broker.create({ data });
        await audit(tx, "Broker", created.id, "CREATE", null, created);
        return created;
      });
    }
    case "categorias": {
      const data = moduleSchemas.categorias.parse(input);
      return prisma.$transaction(async (tx) => {
        const created = await tx.financialCategory.create({ data });
        await audit(tx, "FinancialCategory", created.id, "CREATE", null, created);
        return created;
      });
    }
    case "contas": {
      const data = moduleSchemas.contas.parse(input);
      return prisma.$transaction(async (tx) => {
        const created = await tx.bankAccount.create({ data });
        await audit(tx, "BankAccount", created.id, "CREATE", null, created);
        return created;
      });
    }
  }
}

export async function updateRecord(module: ModuleName, id: string, input: unknown) {
  switch (module) {
    case "pessoas": {
      const data = moduleSchemas.pessoas.parse(input);
      return prisma.$transaction(async (tx) => {
        const before = await tx.person.findUniqueOrThrow({ where: { id }, include: { roles: true } });
        const updated = await tx.person.update({
          where: { id },
          data: {
            ...data,
            roles: { deleteMany: {}, create: data.roles.map((role) => ({ role })) },
          },
          include: { roles: true },
        });
        const action = before.active === updated.active ? "UPDATE" : updated.active ? "ACTIVATE" : "INACTIVATE";
        await audit(tx, "Person", id, action, before, updated);
        return updated;
      });
    }
    case "corretores": {
      const data = moduleSchemas.corretores.parse(input);
      return prisma.$transaction(async (tx) => {
        const before = await tx.broker.findUniqueOrThrow({ where: { id } });
        const updated = await tx.broker.update({ where: { id }, data });
        const action = before.active === updated.active ? "UPDATE" : updated.active ? "ACTIVATE" : "INACTIVATE";
        await audit(tx, "Broker", id, action, before, updated);
        return updated;
      });
    }
    case "categorias": {
      const data = moduleSchemas.categorias.parse(input);
      return prisma.$transaction(async (tx) => {
        const before = await tx.financialCategory.findUniqueOrThrow({ where: { id } });
        const updated = await tx.financialCategory.update({ where: { id }, data });
        const action = before.active === updated.active ? "UPDATE" : updated.active ? "ACTIVATE" : "INACTIVATE";
        await audit(tx, "FinancialCategory", id, action, before, updated);
        return updated;
      });
    }
    case "contas": {
      const data = moduleSchemas.contas.parse(input);
      return prisma.$transaction(async (tx) => {
        const before = await tx.bankAccount.findUniqueOrThrow({ where: { id } });
        const updated = await tx.bankAccount.update({ where: { id }, data });
        const action = before.active === updated.active ? "UPDATE" : updated.active ? "ACTIVATE" : "INACTIVATE";
        await audit(tx, "BankAccount", id, action, before, updated);
        return updated;
      });
    }
  }
}


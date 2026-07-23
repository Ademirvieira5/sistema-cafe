import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const databasePath = resolve(process.cwd(), "prisma/test.db");
const databaseUrl = `file:${databasePath}`;
let client: PrismaClient;

describe("persistência e histórico da Etapa 1", () => {
  beforeAll(() => {
    if (existsSync(databasePath)) rmSync(databasePath);
    const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
    execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        RUST_LOG: "info",
      },
      stdio: "pipe",
    });
    client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  }, 30_000);

  afterAll(async () => {
    await client?.$disconnect();
    if (existsSync(databasePath)) rmSync(databasePath);
  });

  it("cria os quatro cadastros e registra auditoria", async () => {
    const person = await client.person.create({
      data: { personType: "PF", legalName: "Produtor de Teste", roles: { create: { role: "SUPPLIER" } } },
      include: { roles: true },
    });
    const broker = await client.broker.create({ data: { personType: "PF", name: "Corretor de Teste" } });
    const category = await client.financialCategory.create({ data: { name: "Telefone", type: "EXPENSE" } });
    const account = await client.bankAccount.create({ data: { bankName: "Banco Teste", accountNumber: "123", type: "CHECKING", openingBalance: "1250.35" } });
    await client.auditLog.create({ data: { entityType: "Person", entityId: person.id, action: "CREATE", afterData: JSON.stringify({ legalName: person.legalName }) } });

    expect(person.roles[0].role).toBe("SUPPLIER");
    expect(broker.active).toBe(true);
    expect(category.type).toBe("EXPENSE");
    expect(account.openingBalance.toFixed(2)).toBe("1250.35");
    expect(await client.auditLog.count({ where: { entityId: person.id } })).toBe(1);
  });

  it("inativa sem excluir o registro", async () => {
    const category = await client.financialCategory.create({ data: { name: "Impostos", type: "EXPENSE" } });
    await client.financialCategory.update({ where: { id: category.id }, data: { active: false } });
    expect(await client.financialCategory.findUnique({ where: { id: category.id } })).toMatchObject({ active: false, name: "Impostos" });
  });

  it("bloqueia duplicidade de documento", async () => {
    await client.broker.create({ data: { personType: "PJ", name: "Corretora Um", cpfCnpj: "11444777000161" } });
    await expect(client.broker.create({ data: { personType: "PJ", name: "Corretora Dois", cpfCnpj: "11444777000161" } })).rejects.toThrow();
  });
});

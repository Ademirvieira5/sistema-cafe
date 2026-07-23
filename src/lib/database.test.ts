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
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        HOME: "/tmp",
        XDG_CACHE_HOME: "/tmp/cache",
        XDG_CONFIG_HOME: "/tmp/config",
        RUST_LOG: "info",
        npm_config_cache: "/tmp/npm-cache",
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

  it("grava compra com sacas, vencimentos e comissão do corretor", async () => {
    const supplier = await client.person.create({ data: { personType: "PF", legalName: "Fornecedor Compra", roles: { create: { role: "SUPPLIER" } } } });
    const broker = await client.broker.create({ data: { personType: "PF", name: "Corretor Compra" } });
    const purchase = await client.purchase.create({ data: { sequence: 1, date: new Date("2026-07-23T12:00:00"), supplierId: supplier.id, kilograms: "6000", sacks: "100", pricePerSack: "1850", grossAmount: "185000", totalAmount: "185000", brokerId: broker.id, commissionPercent: "0.5", commissionAmount: "925", installments: { create: [{ number: 1, dueDate: new Date("2026-08-01T12:00:00"), amount: "100000" }, { number: 2, dueDate: new Date("2026-09-01T12:00:00"), amount: "85000" }] } }, include: { installments: true } });
    expect(purchase.sacks.toFixed(3)).toBe("100.000");
    expect(purchase.commissionAmount.toFixed(2)).toBe("925.00");
    expect(purchase.installments).toHaveLength(2);
  });

  it("grava conta geral fixa para compor o mapa diário", async () => {
    const category = await client.financialCategory.create({ data: { name: "Aluguel mensal", type: "EXPENSE" } });
    const entry = await client.generalEntry.create({ data: { direction: "PAYABLE", description: "Aluguel do escritório", categoryId: category.id, dueDate: new Date("2026-08-10T12:00:00"), amount: "2500", fixedMonthly: true } });
    expect(entry.fixedMonthly).toBe(true);
    expect(entry.amount.toFixed(2)).toBe("2500.00");
  });
});

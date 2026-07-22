import { describe, expect, it } from "vitest";
import { bankAccountSchema, brokerSchema, categorySchema, personSchema, purchaseSchema } from "@/lib/validation";
import { parseMoney } from "@/lib/format";

describe("validações dos cadastros", () => {
  it("aceita uma pessoa que é fornecedora e cliente", () => {
    const result = personSchema.parse({
      personType: "PJ",
      legalName: "Cooperativa de Café Exemplo",
      cpfCnpj: "11.444.777/0001-61",
      roles: ["SUPPLIER", "CUSTOMER"],
      active: true,
    });
    expect(result.cpfCnpj).toBe("11444777000161");
    expect(result.roles).toEqual(["SUPPLIER", "CUSTOMER"]);
  });

  it("rejeita CPF ou CNPJ inválido", () => {
    const result = brokerSchema.safeParse({ personType: "PF", name: "Corretor Teste", cpfCnpj: "111.111.111-11", active: true });
    expect(result.success).toBe(false);
  });

  it("exige pelo menos um perfil comercial", () => {
    const result = personSchema.safeParse({ personType: "PF", legalName: "Produtor Teste", roles: [], active: true });
    expect(result.success).toBe(false);
  });

  it("normaliza código de categoria", () => {
    const result = categorySchema.parse({ code: " aluguel ", name: "Aluguel", type: "EXPENSE", active: true });
    expect(result.code).toBe("ALUGUEL");
  });

  it("aceita saldo bancário em formato brasileiro sem ponto flutuante no transporte", () => {
    const result = bankAccountSchema.parse({ bankName: "Banco Exemplo", accountNumber: "12345", type: "CHECKING", openingBalance: "1.234,56", active: true });
    expect(result.openingBalance).toBe("1234.56");
  });
});

describe("valores monetários", () => {
  it("normaliza reais para texto decimal exato", () => {
    expect(parseMoney("10.250,37")).toBe("10250.37");
    expect(parseMoney("0,01")).toBe("0.01");
  });

  it("rejeita mais de duas casas decimais", () => {
    expect(parseMoney("10,999")).toBeNull();
  });
});

describe("compra de café", () => {
  it("aceita um vencimento inicial e comissão percentual", () => {
    const result = purchaseSchema.parse({ date: "2026-07-23", supplierId: "fornecedor-1", kilograms: "6.000,000", pricePerSack: "1.850,00", adjustmentAmount: "0,00", brokerId: "corretor-1", commissionMode: "PERCENT", commissionValue: "0,5", installments: [{ dueDate: "2026-08-01", amount: "185.000,00" }] });
    expect(result.kilograms).toBe("6000.000");
    expect(result.commissionValue).toBe("0.5");
    expect(result.installments).toHaveLength(1);
  });

  it("aceita comissão preenchida diretamente em reais e vários vencimentos", () => {
    const result = purchaseSchema.parse({ date: "2026-07-23", supplierId: "fornecedor-1", kilograms: "6000", pricePerSack: "1850", adjustmentAmount: "0", commissionMode: "AMOUNT", commissionValue: "925,00", installments: [{ dueDate: "2026-08-01", amount: "100.000,00" }, { dueDate: "2026-09-01", amount: "85.000,00" }] });
    expect(result.commissionMode).toBe("AMOUNT");
    expect(result.installments).toHaveLength(2);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { purchaseSchema } from "../lib/validation.ts";

test("preserva os corretores ao validar negócio criado por XML", () => {
  const parsed = purchaseSchema.parse({
    operationKey: "11111111-1111-4111-8111-111111111111",
    xmlDocumentId: "xml-1",
    businessType: "PURCHASE",
    date: "2026-08-15",
    supplierId: "supplier-1",
    kilograms: "15050.000",
    receivedKilograms: "",
    pricePerSack: "1805.00",
    adjustmentAmount: "0.00",
    brokerId: "broker-1",
    commissionMode: "PERCENT",
    commissionValue: "0.5",
    brokers: [{ brokerId: "broker-1", commissionMode: "PERCENT", commissionValue: "0.5" }],
    notes: "NF-e 47",
    installments: [{ dueDate: "2026-08-19", amount: "452754.17" }],
  });
  assert.deepEqual(parsed.brokers, [{ brokerId: "broker-1", commissionMode: "PERCENT", commissionValue: "0.5" }]);
  assert.equal(parsed.xmlDocumentId, "xml-1");
});

test("aceita negócio manual sem XML e fornecedor sem documento", () => {
  const parsed = purchaseSchema.parse({
    operationKey: "22222222-2222-4222-8222-222222222222",
    xmlDocumentId: null,
    businessType: "PURCHASE",
    date: "2026-08-19",
    supplierId: "cadastro-somente-com-nome",
    kilograms: "703,8",
    receivedKilograms: "703,80",
    pricePerSack: "1.700,00",
    adjustmentAmount: "0,00",
    brokerId: "",
    commissionMode: "PERCENT",
    commissionValue: "0",
    brokers: [],
    installments: [{ dueDate: "2026-08-19", amount: "19.941,00" }],
  });
  assert.equal(parsed.xmlDocumentId, undefined);
  assert.equal(parsed.kilograms, "703.8");
  assert.equal(parsed.pricePerSack, "1700.00");
});

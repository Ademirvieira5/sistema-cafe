import test from "node:test";
import assert from "node:assert/strict";
import { parseChequeText } from "../lib/cheque-ocr.ts";
import { clientOperationKey } from "../lib/client-id.ts";

test("extrai os principais campos de um cheque fotografado",()=>{
  const result=parseChequeText("BANCO SICOOB AGÊNCIA: 3140 CONTA: 10345-7 CHEQUE Nº 008812 R$ 12.450,90 BOM PARA 25/09/2026 EMITENTE: CAFÉ EXEMPLO LTDA");
  assert.equal(result.bankName,"Sicoob");
  assert.equal(result.agency,"3140");
  assert.equal(result.accountNumber,"10345-7");
  assert.equal(result.checkNumber,"008812");
  assert.equal(result.amount,"12.450,90");
  assert.equal(result.dueDate,"2026-09-25");
  assert.match(result.issuerName,/CAFÉ EXEMPLO LTDA/);
});

test("retorna campos vazios quando a leitura não é confiável",()=>{
  const result=parseChequeText("imagem ilegível");
  assert.equal(result.amount,"");
  assert.equal(result.checkNumber,"");
  assert.equal(result.dueDate,"");
});

test("gera chave de operação compatível sem depender de randomUUID",()=>{
  const first=clientOperationKey(),second=clientOperationKey();
  assert.match(first,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first,second);
});

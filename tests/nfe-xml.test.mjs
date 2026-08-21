import test from "node:test";
import assert from "node:assert/strict";
import { classifyNfe, parseNfeXml } from "../lib/nfe-xml.ts";

const key = "31260803949261000140550010000001231000001234";
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${key}">
<ide><serie>1</serie><nNF>123</nNF><dhEmi>2026-08-19T10:30:00-03:00</dhEmi></ide>
<emit><CNPJ>03949261000140</CNPJ><xNome>FORNECEDOR DE CAFÉ LTDA</xNome><xFant>CAFÉ BOM</xFant><IE>123456</IE><enderEmit><xLgr>Rua Um</xLgr><nro>10</nro><xBairro>Centro</xBairro><xMun>Belo Horizonte</xMun><UF>MG</UF><CEP>30110000</CEP></enderEmit></emit>
<dest><CNPJ>11111111000191</CNPJ><xNome>CAFÉ BH LTDA</xNome><enderDest><xLgr>Rua Dois</xLgr><nro>20</nro><xMun>Belo Horizonte</xMun><UF>MG</UF></enderDest></dest>
<det nItem="1"><prod><cProd>1</cProd><xProd>CAFÉ CRU EM GRÃOS</xProd><NCM>09011110</NCM><CFOP>5102</CFOP><uCom>SC</uCom><qCom>100</qCom><vUnCom>1700.00</vUnCom><vProd>170000.00</vProd></prod></det>
<total><ICMSTot><vProd>170000.00</vProd><vFrete>0.00</vFrete><vDesc>0.00</vDesc><vOutro>0.00</vOutro><vNF>170000.00</vNF></ICMSTot></total>
<cobr><dup><nDup>001</nDup><dVenc>2026-08-25</dVenc><vDup>170000.00</vDup></dup></cobr>
</infNFe></NFe><protNFe><infProt><chNFe>${key}</chNFe></infProt></protNFe></nfeProc>`;

test("interpreta NF-e de café e estima sacas, quilos e preço", () => {
  const parsed = parseNfeXml(xml);
  assert.equal(parsed.accessKey, key);
  assert.equal(parsed.number, "123");
  assert.equal(parsed.issueDate, "2026-08-19");
  assert.equal(parsed.issuer.document, "03949261000140");
  assert.equal(parsed.estimatedKilograms, 6000);
  assert.equal(parsed.estimatedPricePerSack, 1700);
  assert.deepEqual(parsed.installments, [{ number: "001", dueDate: "2026-08-25", amount: 170000 }]);
});

test("recusa XML sem NF-e e documento com entidade externa", () => {
  assert.throws(() => parseNfeXml("<root />"), /XML_NFE_NOT_FOUND/);
  assert.throws(() => parseNfeXml("<!DOCTYPE x [<!ENTITY file SYSTEM 'file:///etc/passwd'>]><root />"), /XML_UNSAFE/);
});

test("reconhece nota própria de entrada de produtor e extrai o Funrural informado", () => {
  const producerKey = "35260811034316000463550010000074871359160095";
  const producerXml = `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${producerKey}">
  <ide><natOp>COMPRAS</natOp><tpNF>0</tpNF><finNFe>1</finNFe><serie>1</serie><nNF>7487</nNF><dhEmi>2026-08-19T07:59:18-02:00</dhEmi></ide>
  <emit><CNPJ>11034316000463</CNPJ><xNome>BELO HORIZONTE COMERCIO DE CAFE LTDA</xNome><enderEmit><xMun>GARCA</xMun><UF>SP</UF></enderEmit></emit>
  <dest><CNPJ>10504412000112</CNPJ><xNome>JOSE ROBERTO MENOI E OUTRA</xNome><IE>713063615111</IE><enderDest><xMun>GARCA</xMun><UF>SP</UF></enderDest></dest>
  <det nItem="1"><prod><cProd>00001</cProd><xProd>CAFE BENEFICIADO CRU</xProd><NCM>09011110</NCM><CFOP>1102</CFOP><uCom>SC</uCom><qCom>21.0000</qCom><vUnCom>1525.00</vUnCom><vProd>32025.00</vProd></prod></det>
  <total><ICMSTot><vProd>32025.00</vProd><vFrete>0</vFrete><vDesc>0</vDesc><vOutro>0</vOutro><vNF>32025.00</vNF></ICMSTot></total>
  <infAdic><infCpl>NFE REF A NFE 170810001 FUNRURAL ALIQUOTA DE 1,63 VALOR DE 522,00.</infCpl></infAdic>
  </infNFe></NFe><protNFe><infProt><chNFe>${producerKey}</chNFe></infProt></protNFe></nfeProc>`;
  const parsed = parseNfeXml(producerXml), classification = classifyNfe(parsed);
  assert.equal(classification.code, "PURCHASE");
  assert.equal(classification.counterparty, "RECIPIENT");
  assert.equal(classification.confidence, "CONFIRMED");
  assert.equal(parsed.funrural.detected, true);
  assert.equal(parsed.funrural.rate, 1.63);
  assert.equal(parsed.funrural.amount, 522);
  assert.equal(parsed.estimatedKilograms, 1260);
});

test("distingue venda, devolução e transferência pelos CNPJs e finalidade fiscal", () => {
  const base = parseNfeXml(xml);
  const own = { ...base, issuer: { ...base.issuer, document: "11034316000463" }, recipient: { ...base.recipient, document: "99999999000199" }, operationType: "1", fiscalPurpose: "1", operationNature: "VENDA", referencedAccessKeys: [] };
  assert.equal(classifyNfe(own).code, "SALE");
  assert.equal(classifyNfe({ ...own, issuer: { ...own.issuer, document: "99999999000199" }, recipient: { ...own.recipient, document: "11034316000463" }, fiscalPurpose: "4", operationNature: "DEVOLUCAO", referencedAccessKeys: [key] }).code, "SALE_RETURN");
  assert.equal(classifyNfe({ ...own, recipient: { ...own.recipient, document: "11034316000544" }, operationNature: "TRANSFERENCIA", items: own.items.map((item) => ({ ...item, cfop: "5152" })) }).code, "TRANSFER");
});

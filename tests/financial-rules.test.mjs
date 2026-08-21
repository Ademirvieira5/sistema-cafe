import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateCoffeeTotals, calculateMonthlyInventory, calculatePhysicalClosingInventory, funruralReconciliationStatus, monthlyDueDates, nextRecurringTax, normalizeOptionalFilter, normalizeReportDirection } from "../lib/financial-rules.ts";
import { cents, decimal } from "../lib/d1.ts";

test("monthly recurrence preserves the day and clamps month end",()=>{
  const dates=monthlyDueDates("2026-01-31",3);
  assert.deepEqual(dates,["2026-01-31","2026-02-28","2026-03-31"]);
});

test("tributo mensal gera apenas a próxima previsão mantendo o tipo",()=>{
  assert.deepEqual(nextRecurringTax("RECURRING_TAX:FGTS:2026-08","2026-09-20","FGTS 08/2026"),{operationKey:"RECURRING_TAX:FGTS:2026-09",dueDate:"2026-10-20",description:"FGTS 09/2026"});
  assert.equal(nextRecurringTax("FUNRURAL:2026-08","2026-09-20","Funrural"),null);
});

test("agenda setembro sem misturar Funrural aos tributos recorrentes",async()=>{
  const migration=await readFile(new URL("../drizzle/0028_recurring_tax_predictions.sql",import.meta.url),"utf8");
  assert.match(migration,/FGTS 08\/2026[\s\S]*233045/);
  assert.match(migration,/DARF previdenciário sem Funrural 08\/2026[\s\S]*1267320/);
  assert.match(migration,/DARF de retenções 08\/2026[\s\S]*129817/);
  assert.doesNotMatch(migration,/15878338/);
});

test("conferência mensal do Funrural distingue guia, diferença e pagamento",()=>{
  assert.equal(funruralReconciliationStatus(15878338,null,0),"WAITING_GUIDE");
  assert.equal(funruralReconciliationStatus(15878338,15878000,0),"DIFFERENCE");
  assert.equal(funruralReconciliationStatus(15878338,15878338,0),"CONFIRMED");
  assert.equal(funruralReconciliationStatus(15878338,15878338,15878338),"PAID");
  assert.equal(funruralReconciliationStatus(15878338,15878000,15878338),"DIFFERENCE");
});

test("ALL report direction becomes an unfiltered query",()=>{
  assert.equal(normalizeReportDirection("ALL"),null);
  assert.equal(normalizeReportDirection("PAYABLE"),"PAYABLE");
  assert.equal(normalizeReportDirection("RECEIVABLE"),"RECEIVABLE");
});

test("filtro vazio de pessoa consulta todos os cadastros",()=>{
  assert.equal(normalizeOptionalFilter(""),null);
  assert.equal(normalizeOptionalFilter("   "),null);
  assert.equal(normalizeOptionalFilter(" pessoa-1 "),"pessoa-1");
});

test("coffee totals use arrival weight, adjustment and percentage commission",()=>{
  assert.deepEqual(calculateCoffeeTotals(600,1000,5000,"PERCENT",2,true),{grossCents:1000000,totalCents:1005000,commissionCents:20100});
});

test("coffee commission is zero when there is no broker",()=>{
  assert.equal(calculateCoffeeTotals(60,1000,0,"AMOUNT",500,true).commissionCents,50000);
  assert.equal(calculateCoffeeTotals(60,1000,0,"AMOUNT",500,false).commissionCents,0);
});

test("lancamento da compra confere exatamente com a parcela",()=>{
  const totals=calculateCoffeeTotals(decimal("11787.6"),decimal("1468.28"),cents("0.00"),"PERCENT",decimal("0.7"),true);
  assert.equal(totals.totalCents,28845829);
  assert.equal(totals.commissionCents,201921);
  assert.equal(cents("288458.29"),totals.totalCents);
});

test("month closing becomes the exact basis for the next opening",()=>{
  const january=calculateMonthlyInventory(6000000,10000000,12000000,22000000,9000000,18000000);
  const february=calculateMonthlyInventory(january.closingKilogramsMilli,january.closingValueCents,0,0,0,0);
  assert.equal(february.availableKilogramsMilli,january.closingKilogramsMilli);
  assert.equal(february.availableValueCents,january.closingValueCents);
  assert.equal(january.costOfGoodsSoldCents,16000000);
  assert.equal(january.grossProfitCents,2000000);
});

test("reported physical closing and market price define the closing value",()=>{
  const january=calculatePhysicalClosingInventory(6000000,10000000,12000000,22000000,9000000,18000000,8500000,200000);
  assert.equal(january.theoreticalClosingKilogramsMilli,9000000);
  assert.equal(january.physicalAdjustmentKilogramsMilli,-500000);
  assert.equal(january.closingKilogramsMilli,8500000);
  assert.equal(january.closingPricePerSackCents,200000);
  assert.equal(january.closingValueCents,28333333);
  assert.equal(january.costOfGoodsSoldCents,3666667);
  const february=calculatePhysicalClosingInventory(january.closingKilogramsMilli,january.closingValueCents,0,0,0,0,null);
  assert.equal(february.availableKilogramsMilli,january.closingKilogramsMilli);
  assert.equal(february.availableValueCents,january.closingValueCents);
});

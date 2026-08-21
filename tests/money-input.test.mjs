import assert from "node:assert/strict";
import test from "node:test";
import { finalizeMoneyInput, formatMoneyTyping, moneyFromCents, moneyFromDecimal } from "../lib/money-input.ts";
import { parseMoney } from "../lib/format.ts";
import { cents, decimal, kilogramsMilli } from "../lib/d1.ts";

test("agrupa reais enquanto digita sem inventar centavos", () => {
  assert.equal(formatMoneyTyping("3124804"), "3.124.804");
  assert.equal(finalizeMoneyInput("3124804"), "3.124.804,00");
});

test("usa a virgula digitada como separador de centavos", () => {
  assert.equal(formatMoneyTyping("3124804,84"), "3.124.804,84");
  assert.equal(finalizeMoneyInput("3.124.804,8"), "3.124.804,80");
  assert.equal(parseMoney("3.124.804,84"), "3124804.84");
  assert.equal(parseMoney("3.124.804"), "3124804.00");
});

test("mantem o ponto decimal depois da validacao do servidor", () => {
  assert.equal(decimal("11787.6"), 11787.6);
  assert.equal(kilogramsMilli("11787.6"), 11787600);
  assert.equal(cents("1468.28"), 146828);
  assert.equal(cents("288458.29"), 28845829);
  assert.equal(cents("1.468,28"), 146828);
});

test("formata valores vindos da API e ajustes negativos", () => {
  assert.equal(moneyFromDecimal("3124804.84"), "3.124.804,84");
  assert.equal(moneyFromDecimal("25"), "25,00");
  assert.equal(formatMoneyTyping("-1234,5", true), "-1.234,5");
  assert.equal(moneyFromCents(-123450), "-1.234,50");
});

import { z } from "zod";
import { onlyDigits, parseMoney } from "./format.ts";

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const operationKey = z.string().uuid("Identificador da operação inválido");

function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = (base: string, factor: number) => {
    let total = 0;
    for (const number of base) total += Number(number) * factor--;
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(value.slice(0, 9), 10) === Number(value[9]) && digit(value.slice(0, 10), 11) === Number(value[10]);
}

function validCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const calculate = (base: string) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = [...base].reduce((total, number, index) => total + Number(number) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calculate(value.slice(0, 12)) === Number(value[12]) && calculate(value.slice(0, 13)) === Number(value[13]);
}

const documentField = z
  .string()
  .trim()
  .transform((value) => onlyDigits(value))
  .refine((value) => !value || validCpf(value) || validCnpj(value), "CPF ou CNPJ inválido")
  .transform((value) => value || undefined)
  .optional();

const emailField = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .refine((value) => !value || z.string().email().safeParse(value).success, "E-mail inválido")
  .optional();

export const personSchema = z.object({
  personType: z.enum(["PF", "PJ"]),
  classification: z.enum(["COMPANY", "RURAL_PRODUCER", "INDIVIDUAL", "OTHER"]),
  legalName: z.string().trim().min(2, "Informe o nome ou razão social").max(160),
  tradeName: optionalText,
  cpfCnpj: documentField,
  rgIe: optionalText,
  email: emailField,
  phone: optionalText,
  zipCode: optionalText.transform((value) => (value ? onlyDigits(value) : undefined)),
  street: optionalText,
  number: optionalText,
  complement: optionalText,
  district: optionalText,
  city: optionalText,
  state: optionalText.refine((value) => !value || /^[A-Za-z]{2}$/.test(value), "Use a sigla do estado com 2 letras").transform((value) => value?.toUpperCase()),
  country: optionalText.transform((value) => value?.toUpperCase() || "BRASIL"),
  funruralStatus: z.enum(["REVIEW", "WITHHOLD", "EXEMPT", "NOT_APPLICABLE"]),
  notes: optionalText,
  roles: z.array(z.enum(["SUPPLIER", "CUSTOMER", "BROKER", "DEPOSITOR", "WAREHOUSE"])).min(1, "Selecione pelo menos um relacionamento"),
  active: z.boolean().default(true),
});

export const brokerSchema = z.object({
  personType: z.enum(["PF", "PJ"]),
  name: z.string().trim().min(2, "Informe o nome do corretor").max(160),
  tradeName: optionalText,
  cpfCnpj: documentField,
  rgIe: optionalText,
  email: emailField,
  phone: optionalText,
  pixKey: optionalText,
  notes: optionalText,
  active: z.boolean().default(true),
});

export const categorySchema = z.object({
  code: optionalText.transform((value) => value?.toUpperCase()),
  name: z.string().trim().min(2, "Informe o nome da categoria").max(100),
  type: z.enum(["INCOME", "EXPENSE", "BOTH"]),
  description: optionalText,
  active: z.boolean().default(true),
});

export const bankAccountSchema = z.object({
  bankCode: optionalText,
  bankName: z.string().trim().min(2, "Informe o nome do banco").max(120),
  agency: optionalText,
  accountNumber: z.string().trim().min(1, "Informe o número da conta").max(30),
  accountDigit: optionalText,
  type: z.enum(["CHECKING", "SAVINGS", "INVESTMENT", "CASH"]),
  description: optionalText,
  openingBalance: z.unknown().transform((value, ctx) => {
    const parsed = parseMoney(value);
    if (parsed === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Saldo inicial inválido" });
      return z.NEVER;
    }
    return parsed;
  }),
  active: z.boolean().default(true),
});

const decimalText = (label: string, scale = 2) => z.unknown().transform((value, ctx) => {
  const raw = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (!new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`).test(raw) || Number(raw) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} inválido` });
    return z.NEVER;
  }
  return raw;
});

export const purchaseSchema = z.object({
  operationKey,
  xmlDocumentId: z.preprocess((value) => value === null || value === "" ? undefined : value, optionalText),
  businessType: z.enum(["PURCHASE", "SALE"]),
  date: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Data inválida"),
  supplierId: z.string().min(1, "Selecione o fornecedor"),
  kilograms: decimalText("Quantidade em quilos", 3),
  receivedKilograms: z.unknown().transform((value, ctx) => {
    const raw = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");
    if (!raw) return undefined;
    if (!/^\d+(\.\d{1,3})?$/.test(raw) || Number(raw) <= 0) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Peso de chegada inválido" }); return z.NEVER; }
    return raw;
  }).optional(),
  pricePerSack: decimalText("Preço por saca"),
  adjustmentAmount: z.unknown().transform((value, ctx) => {
    const parsed = parseMoney(value);
    if (parsed === null) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ajuste inválido" }); return z.NEVER; }
    return parsed;
  }),
  brokerId: optionalText,
  commissionMode: z.enum(["PERCENT", "AMOUNT"]),
  commissionValue: z.unknown().transform((value, ctx) => {
    const input = String(value ?? "0").trim();
    const raw = input.includes(",") ? input.replace(/\./g, "").replace(",", ".") : input;
    if (!/^\d+(\.\d{1,4})?$/.test(raw)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Comissão inválida" }); return z.NEVER; }
    return raw;
  }),
  brokers: z.array(z.object({
    brokerId: z.string().min(1, "Selecione o corretor"),
    commissionMode: z.enum(["PERCENT", "AMOUNT"]),
    commissionValue: z.unknown().transform((value, ctx) => {
      const input = String(value ?? "0").trim();
      const raw = input.includes(",") ? input.replace(/\./g, "").replace(",", ".") : input;
      if (!/^\d+(\.\d{1,4})?$/.test(raw)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Comissão inválida" }); return z.NEVER; }
      return raw;
    }),
  })).max(5, "Informe no máximo cinco corretores").optional().default([]),
  notes: optionalText,
  installments: z.array(z.object({
    id: optionalText,
    dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Vencimento inválido"),
    amount: decimalText("Valor do vencimento"),
  })).min(1, "Informe pelo menos um vencimento"),
});

export const generalEntrySchema = z.object({
  operationKey,
  direction: z.enum(["PAYABLE", "RECEIVABLE"]),
  description: z.string().trim().min(2, "Informe a descrição").max(160),
  categoryId: z.string().min(1, "Selecione a categoria"),
  personId: optionalText,
  dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Vencimento inválido"),
  amount: decimalText("Valor"),
  fixedMonthly: z.boolean().default(false),
  notes: optionalText,
});

export const saleReturnSchema = z.object({
  dealId: z.string().min(1, "Selecione a venda original"),
  financialTreatment: z.enum(["FISCAL_ONLY", "REFUND_PAYABLE"]),
  dueDate: optionalText,
  notes: optionalText,
}).superRefine((value, ctx) => {
  if (value.financialTreatment === "REFUND_PAYABLE" && (!value.dueDate || Number.isNaN(Date.parse(`${value.dueDate}T12:00:00`)))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dueDate"], message: "Informe o vencimento da devolução" });
});

export const settlementSchema = z.object({
  operationKey,
  originType: z.enum(["INSTALLMENT", "GENERAL_ENTRY"]),
  originId: z.string().min(1),
  bankAccountId: z.string().min(1, "Selecione a conta bancária"),
  method: z.enum(["PIX", "TED", "CHECK", "DEBIT", "CASH", "TRANSFER", "OTHER"]),
  status: z.enum(["CONFIRMED", "CLEARED"]).default("CONFIRMED"),
  amount: decimalText("Valor da baixa"),
  movementDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Data inválida"),
  description: optionalText,
  document: optionalText,
  checkNumber: optionalText,
  notes: optionalText,
}).superRefine((value, ctx) => {
  if (value.method === "CHECK" && !value.checkNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checkNumber"], message: "Informe o número do cheque" });
});

const ownCheckSchema = z.object({
  checkNumber: z.string().trim().min(1, "Informe o número do cheque"),
  amount: decimalText("Valor do cheque"),
  issueDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Data de emissão inválida"),
  dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Data de compensação inválida"),
});

export const checkBatchSettlementSchema = z.object({
  operationKey,
  originType: z.enum(["INSTALLMENT", "GENERAL_ENTRY"]),
  originId: z.string().min(1),
  bankAccountId: z.string().min(1, "Selecione a conta bancária"),
  status: z.enum(["CONFIRMED", "CLEARED"]).default("CONFIRMED"),
  description: optionalText,
  document: optionalText,
  notes: optionalText,
  checks: z.array(ownCheckSchema).min(1, "Inclua pelo menos um cheque").max(30, "O lote pode ter no máximo 30 cheques"),
}).superRefine((value, ctx) => {
  const numbers = new Set<string>();
  value.checks.forEach((check, index) => {
    const normalized = check.checkNumber.replace(/^0+/, "") || "0";
    if (numbers.has(normalized)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checks", index, "checkNumber"], message: "Número repetido neste lote" });
    numbers.add(normalized);
    if (check.dueDate < check.issueDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checks", index, "dueDate"], message: "A compensação não pode ser anterior à emissão" });
  });
});

export const brokerCommissionPaymentSchema = z.object({
  operationKey,
  bankAccountId: z.string().min(1, "Selecione a conta bancária"),
  method: z.enum(["PIX", "TED", "CHECK", "DEBIT", "CASH", "TRANSFER", "OTHER"]),
  status: z.enum(["CONFIRMED", "CLEARED"]).default("CONFIRMED"),
  amount: decimalText("Valor do pagamento"),
  movementDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Data inválida"),
  document: optionalText,
  checkNumber: optionalText,
  notes: optionalText,
});

export const transferSchema = z.object({
  operationKey,
  sourceAccountId: z.string().min(1, "Selecione a conta de origem"),
  destinationAccountId: z.string().min(1, "Selecione a conta de destino"),
  amount: decimalText("Valor da transferência"),
  movementDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Data inválida"),
  status: z.enum(["CONFIRMED", "CLEARED"]).default("CONFIRMED"),
  document: optionalText,
  notes: optionalText,
}).refine((value) => value.sourceAccountId !== value.destinationAccountId, { message: "Selecione contas diferentes para a transferência", path: ["destinationAccountId"] });

const optionalDate = optionalText.refine((value) => !value || !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Data inválida");

export const bankTransactionSchema = z.object({
  operationKey,
  bankAccountId: z.string().min(1, "Selecione a conta bancária"),
  direction: z.enum(["IN", "OUT"]),
  method: z.enum(["PIX", "TED", "CHECK", "DEBIT", "CASH", "OTHER"]),
  status: z.enum(["PLANNED", "CONFIRMED", "CLEARED"]),
  dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Vencimento inválido"),
  movementDate: optionalDate,
  amount: decimalText("Valor"),
  counterparty: z.string().trim().min(2, "Informe o favorecido ou pagador").max(160),
  description: z.string().trim().min(2, "Informe a descrição").max(200),
  categoryId: z.string().min(1, "Selecione a categoria financeira"),
  document: optionalText,
  checkNumber: optionalText,
  notes: optionalText,
}).superRefine((value, ctx) => {
  if (value.method === "CHECK" && !value.checkNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checkNumber"], message: "Informe o número do cheque" });
});

export const inventorySettingSchema = z.object({
  startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inicial inválido"),
  openingKilograms: z.unknown().transform((value,ctx)=>{
    const raw=String(value??"").trim().replace(/\./g,"").replace(",",".");
    if(!/^\d+(\.\d{1,3})?$/.test(raw)){ctx.addIssue({code:z.ZodIssueCode.custom,message:"Estoque inicial em quilos inválido"});return z.NEVER}
    return raw;
  }),
  openingPricePerSack: z.unknown().transform((value,ctx)=>{
    const parsed=parseMoney(value);
    if(parsed===null||parsed<0){ctx.addIssue({code:z.ZodIssueCode.custom,message:"Preço por saca do estoque anterior inválido"});return z.NEVER}
    return parsed;
  }),
});

export const inventoryClosingSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido"),
  closingKilograms: z.unknown().transform((value,ctx)=>{
    const input=String(value??"").trim(),raw=input.includes(",")?input.replace(/\./g,"").replace(",","."):input;
    if(!/^\d+(\.\d{1,3})?$/.test(raw)){ctx.addIssue({code:z.ZodIssueCode.custom,message:"Estoque final em quilos inválido"});return z.NEVER}
    return raw;
  }),
  closingPricePerSack: z.unknown().transform((value,ctx)=>{
    const parsed=parseMoney(value);
    if(parsed===null||Number(parsed)<=0){ctx.addIssue({code:z.ZodIssueCode.custom,message:"Preço de mercado por saca inválido"});return z.NEVER}
    return parsed;
  }),
});

const chequeOriginSchema=z.object({type:z.enum(["INSTALLMENT","GENERAL_ENTRY"]),id:z.string().min(1)}).nullable().optional();
const chequeRowSchema=z.object({
  operationKey,
  bankName:z.string().trim().min(2,"Informe o banco").max(120),
  agency:optionalText,
  accountNumber:optionalText,
  checkNumber:z.string().trim().min(1,"Informe o número do cheque").max(40),
  issuerName:z.string().trim().min(2,"Informe o emitente").max(160),
  amount:decimalText("Valor do cheque"),
  dueDate:z.string().refine(value=>!Number.isNaN(Date.parse(`${value}T12:00:00`)),"Data inválida"),
  imageKey:optionalText,
  ocrConfidence:z.number().int().min(0).max(100).optional(),
  notes:optionalText,
});
export const chequeBatchSchema=z.object({
  receivedFromPersonId:optionalText,
  receivedAt:z.string().refine(value=>!Number.isNaN(Date.parse(`${value}T12:00:00`)),"Data de recebimento inválida"),
  receiptOrigin:chequeOriginSchema,
  notes:optionalText,
  cheques:z.array(chequeRowSchema).min(1,"Inclua pelo menos um cheque").max(100,"O lote pode ter no máximo 100 cheques"),
});
export const chequeActionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("DEPOSIT"),date:z.string(),bankAccountId:z.string().min(1),notes:optionalText}),
  z.object({action:z.literal("CLEAR"),date:z.string(),notes:optionalText}),
  z.object({action:z.literal("RETURN"),date:z.string(),notes:optionalText}),
  z.object({action:z.literal("TRANSFER"),date:z.string(),personId:z.string().min(1),origin:chequeOriginSchema,notes:optionalText}),
  z.object({action:z.literal("RECOVER"),date:z.string(),notes:optionalText}),
  z.object({action:z.literal("CANCEL"),date:z.string(),notes:optionalText}),
]);

export const moduleSchemas = {
  pessoas: personSchema,
  corretores: brokerSchema,
  categorias: categorySchema,
  contas: bankAccountSchema,
} as const;

export type ModuleName = keyof typeof moduleSchemas;

export function isModuleName(value: string): value is ModuleName {
  return value in moduleSchemas;
}

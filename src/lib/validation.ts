import { z } from "zod";
import { onlyDigits, parseMoney } from "@/lib/format";

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

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
  notes: optionalText,
  roles: z.array(z.enum(["SUPPLIER", "CUSTOMER"])).min(1, "Selecione fornecedor e/ou cliente"),
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
  businessType: z.enum(["PURCHASE", "SALE"]),
  date: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Data inválida"),
  supplierId: z.string().min(1, "Selecione o fornecedor"),
  kilograms: decimalText("Quantidade em quilos", 3),
  pricePerSack: decimalText("Preço por saca"),
  adjustmentAmount: z.unknown().transform((value, ctx) => {
    const parsed = parseMoney(value);
    if (parsed === null) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ajuste inválido" }); return z.NEVER; }
    return parsed;
  }),
  brokerId: optionalText,
  commissionMode: z.enum(["PERCENT", "AMOUNT"]),
  commissionValue: z.unknown().transform((value, ctx) => {
    const raw = String(value ?? "0").trim().replace(/\./g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,4})?$/.test(raw)) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Comissão inválida" }); return z.NEVER; }
    return raw;
  }),
  notes: optionalText,
  installments: z.array(z.object({
    dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Vencimento inválido"),
    amount: decimalText("Valor do vencimento"),
  })).min(1, "Informe pelo menos um vencimento"),
});

export const generalEntrySchema = z.object({
  direction: z.enum(["PAYABLE", "RECEIVABLE"]),
  description: z.string().trim().min(2, "Informe a descrição").max(160),
  categoryId: z.string().min(1, "Selecione a categoria"),
  personId: optionalText,
  dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00`)), "Vencimento inválido"),
  amount: decimalText("Valor"),
  fixedMonthly: z.boolean().default(false),
  notes: optionalText,
});

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

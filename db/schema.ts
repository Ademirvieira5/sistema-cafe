import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  personType: text("person_type", { enum: ["PF", "PJ"] }).notNull(),
  classification: text("classification", { enum: ["COMPANY", "RURAL_PRODUCER", "INDIVIDUAL", "OTHER"] }).notNull().default("COMPANY"),
  legalName: text("legal_name").notNull(),
  tradeName: text("trade_name"),
  cpfCnpj: text("cpf_cnpj").unique(),
  rgIe: text("rg_ie"), email: text("email"), phone: text("phone"),
  zipCode: text("zip_code"), street: text("street"), number: text("number"),
  complement: text("complement"), district: text("district"), city: text("city"), state: text("state"),
  country: text("country").notNull().default("BRASIL"),
  funruralStatus: text("funrural_status", { enum: ["REVIEW", "WITHHOLD", "EXEMPT", "NOT_APPLICABLE"] }).notNull().default("REVIEW"),
  source: text("source").notNull().default("MANUAL"),
  legacySourceKey: text("legacy_source_key").unique(),
  lastInvoiceAt: text("last_invoice_at"),
  lastImportedAt: text("last_imported_at"),
  notes: text("notes"), active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const personRoles = sqliteTable("person_roles", {
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["SUPPLIER", "CUSTOMER", "BROKER", "DEPOSITOR", "WAREHOUSE"] }).notNull(),
}, (table) => [primaryKey({ columns: [table.personId, table.role] })]);

export const brokers = sqliteTable("brokers", {
  id: text("id").primaryKey(), personType: text("person_type", { enum: ["PF", "PJ"] }).notNull(),
  name: text("name").notNull(), tradeName: text("trade_name"), cpfCnpj: text("cpf_cnpj").unique(),
  rgIe: text("rg_ie"), email: text("email"), phone: text("phone"), pixKey: text("pix_key"), notes: text("notes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps,
});

export const financialCategories = sqliteTable("financial_categories", {
  id: text("id").primaryKey(), code: text("code").unique(), name: text("name").notNull(),
  type: text("type", { enum: ["INCOME", "EXPENSE", "BOTH"] }).notNull(), description: text("description"),
  active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps,
}, (table) => [uniqueIndex("category_name_type_unique").on(table.name, table.type)]);

export const bankAccounts = sqliteTable("bank_accounts", {
  id: text("id").primaryKey(), bankCode: text("bank_code"), bankName: text("bank_name").notNull(), agency: text("agency"),
  accountNumber: text("account_number").notNull(), accountDigit: text("account_digit"),
  type: text("type", { enum: ["CHECKING", "SAVINGS", "INVESTMENT", "CASH"] }).notNull(),
  description: text("description"), openingBalanceCents: integer("opening_balance_cents").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps,
});

export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(), sequence: integer("sequence").notNull().unique(),
  businessType: text("business_type", { enum: ["PURCHASE", "SALE"] }).notNull(), date: text("date").notNull(),
  partyId: text("party_id").notNull().references(() => people.id), kilogramsMilli: integer("kilograms_milli").notNull(),
  contractedKilogramsMilli: integer("contracted_kilograms_milli"), receivedKilogramsMilli: integer("received_kilograms_milli"),
  pricePerSackCents: integer("price_per_sack_cents").notNull(), grossAmountCents: integer("gross_amount_cents").notNull(),
  adjustmentAmountCents: integer("adjustment_amount_cents").notNull().default(0), totalAmountCents: integer("total_amount_cents").notNull(),
  brokerId: text("broker_id").references(() => brokers.id), commissionAmountCents: integer("commission_amount_cents").notNull().default(0),
  commissionMode: text("commission_mode", { enum: ["PERCENT", "AMOUNT"] }), commissionValue: text("commission_value"),
  operationKey: text("operation_key"),
  notes: text("notes"), status: text("status", { enum: ["OPEN", "CANCELLED"] }).notNull().default("OPEN"), ...timestamps,
}, (table) => [
  uniqueIndex("deals_operation_key_unique").on(table.operationKey),
  index("deals_status_date_idx").on(table.status, table.date, table.sequence),
  index("deals_party_status_idx").on(table.partyId, table.status),
]);

export const fiscalDocuments = sqliteTable("fiscal_documents", {
  id: text("id").primaryKey(),
  accessKey: text("access_key").notNull().unique(),
  documentNumber: text("document_number").notNull(),
  series: text("series"),
  businessType: text("business_type", { enum: ["PURCHASE", "SALE"] }).notNull(),
  purpose: text("purpose", { enum: ["DEAL", "SALE_RETURN", "PURCHASE_RETURN", "TRANSFER", "REVIEW"] }).notNull().default("DEAL"),
  classificationConfidence: text("classification_confidence", { enum: ["CONFIRMED", "PROBABLE", "REVIEW"] }).notNull().default("CONFIRMED"),
  classificationReason: text("classification_reason"),
  operationNature: text("operation_nature"),
  operationType: text("operation_type"),
  fiscalPurpose: text("fiscal_purpose"),
  referencedKeysJson: text("referenced_keys_json").notNull().default("[]"),
  funruralDetected: integer("funrural_detected", { mode: "boolean" }).notNull().default(false),
  funruralRate: text("funrural_rate"),
  funruralAmountCents: integer("funrural_amount_cents"),
  funruralSource: text("funrural_source"),
  funruralGeneralEntryId: text("funrural_general_entry_id").references(() => generalEntries.id, { onDelete: "set null" }),
  issueDate: text("issue_date").notNull(),
  partyId: text("party_id").notNull().references(() => people.id),
  issuerName: text("issuer_name").notNull(),
  issuerDocument: text("issuer_document"),
  recipientName: text("recipient_name").notNull(),
  recipientDocument: text("recipient_document"),
  productsAmountCents: integer("products_amount_cents").notNull().default(0),
  discountAmountCents: integer("discount_amount_cents").notNull().default(0),
  freightAmountCents: integer("freight_amount_cents").notNull().default(0),
  otherAmountCents: integer("other_amount_cents").notNull().default(0),
  totalAmountCents: integer("total_amount_cents").notNull(),
  estimatedKilogramsMilli: integer("estimated_kilograms_milli"),
  estimatedPricePerSackCents: integer("estimated_price_per_sack_cents"),
  itemsJson: text("items_json").notNull(),
  installmentsJson: text("installments_json").notNull(),
  xmlKey: text("xml_key").notNull(),
  originalFilename: text("original_filename"),
  status: text("status", { enum: ["PENDING", "LINKED", "IGNORED", "CANCELLED"] }).notNull().default("PENDING"),
  dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
  adjustmentDealId: text("adjustment_deal_id").references(() => deals.id, { onDelete: "set null" }),
  generalEntryId: text("general_entry_id").references(() => generalEntries.id, { onDelete: "set null" }),
  linkedAt: text("linked_at"),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
}, (table) => [
  index("fiscal_documents_deal_status_idx").on(table.dealId, table.status, table.purpose),
  index("fiscal_documents_issue_funrural_idx").on(table.issueDate, table.funruralDetected),
]);

export const dealBrokers = sqliteTable("deal_brokers", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  brokerId: text("broker_id").notNull().references(() => brokers.id),
  position: integer("position").notNull().default(1),
  commissionMode: text("commission_mode", { enum: ["PERCENT", "AMOUNT"] }).notNull(),
  commissionValue: text("commission_value").notNull(),
  commissionAmountCents: integer("commission_amount_cents").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("deal_brokers_deal_broker_unique").on(table.dealId, table.brokerId),
  index("deal_brokers_broker_idx").on(table.brokerId),
]);

export const installments = sqliteTable("installments", {
  id: text("id").primaryKey(), dealId: text("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  number: integer("number").notNull(), dueDate: text("due_date").notNull(), amountCents: integer("amount_cents").notNull(),
  paidAmountCents: integer("paid_amount_cents").notNull().default(0), ...timestamps,
}, (table) => [
  uniqueIndex("installment_deal_number_unique").on(table.dealId, table.number),
  index("installments_due_date_idx").on(table.dueDate),
]);

export const generalEntries = sqliteTable("general_entries", {
  id: text("id").primaryKey(), direction: text("direction", { enum: ["PAYABLE", "RECEIVABLE"] }).notNull(),
  description: text("description").notNull(), categoryId: text("category_id").notNull().references(() => financialCategories.id),
  personId: text("person_id").references(() => people.id), dueDate: text("due_date").notNull(), amountCents: integer("amount_cents").notNull(),
  paidAmountCents: integer("paid_amount_cents").notNull().default(0), fixedMonthly: integer("fixed_monthly", { mode: "boolean" }).notNull().default(false),
  operationKey: text("operation_key"),
  notes: text("notes"), active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps,
}, (table) => [
  uniqueIndex("general_entries_operation_key_unique").on(table.operationKey),
  index("general_entries_active_due_idx").on(table.active, table.dueDate),
]);

export const importedDocuments = sqliteTable("imported_documents", {
  id: text("id").primaryKey(),
  fingerprint: text("fingerprint").notNull().unique(),
  documentType: text("document_type", { enum: ["DARF", "FGTS", "BOLETO", "OTHER"] }).notNull(),
  originalFilename: text("original_filename").notNull(),
  pdfKey: text("pdf_key").notNull(),
  issuerName: text("issuer_name"),
  issuerDocument: text("issuer_document"),
  competence: text("competence"),
  dueDate: text("due_date"),
  documentNumber: text("document_number"),
  amountCents: integer("amount_cents"),
  paymentCode: text("payment_code"),
  detailsJson: text("details_json").notNull().default("{}"),
  status: text("status", { enum: ["REVIEW", "POSTED"] }).notNull().default("REVIEW"),
  generalEntryId: text("general_entry_id").references(() => generalEntries.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [index("imported_documents_status_idx").on(table.status)]);

export const funruralPeriods = sqliteTable("funrural_periods", {
  competence: text("competence").primaryKey(),
  guideAmountCents: integer("guide_amount_cents"),
  importedDocumentId: text("imported_document_id").references(() => importedDocuments.id, { onDelete: "set null" }),
  notes: text("notes"),
  confirmedAt: text("confirmed_at"),
  ...timestamps,
});

export const bankTransactions = sqliteTable("bank_transactions", {
  id: text("id").primaryKey(),
  bankAccountId: text("bank_account_id").notNull().references(() => bankAccounts.id),
  direction: text("direction", { enum: ["IN", "OUT"] }).notNull(),
  method: text("method", { enum: ["PIX", "TED", "CHECK", "DEBIT", "CASH", "TRANSFER", "OTHER"] }).notNull(),
  status: text("status", { enum: ["PLANNED", "CONFIRMED", "CLEARED", "CANCELLED"] }).notNull().default("PLANNED"),
  dueDate: text("due_date").notNull(),
  movementDate: text("movement_date"),
  amountCents: integer("amount_cents").notNull(),
  counterparty: text("counterparty").notNull(),
  description: text("description").notNull(),
  document: text("document"),
  checkNumber: text("check_number"),
  reconciled: integer("reconciled", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  transferGroupId: text("transfer_group_id"),
  operationKey: text("operation_key"),
  financialCategoryId: text("financial_category_id").references(() => financialCategories.id),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  uniqueIndex("bank_transactions_operation_unique").on(table.operationKey, table.bankAccountId, table.direction),
  index("bank_transactions_active_status_due_idx").on(table.active, table.status, table.dueDate),
  index("bank_transactions_account_status_idx").on(table.bankAccountId, table.active, table.status),
]);

export const settlements = sqliteTable("settlements", {
  id: text("id").primaryKey(),
  originType: text("origin_type", { enum: ["INSTALLMENT", "GENERAL_ENTRY"] }).notNull(),
  originId: text("origin_id").notNull(),
  bankTransactionId: text("bank_transaction_id").notNull().references(() => bankTransactions.id),
  amountCents: integer("amount_cents").notNull(),
  operationKey: text("operation_key"),
  settledAt: text("settled_at").notNull(),
  notes: text("notes"),
  ...timestamps,
}, (table) => [
  uniqueIndex("settlement_bank_transaction_unique").on(table.bankTransactionId),
  uniqueIndex("settlement_operation_key_unique").on(table.operationKey),
  uniqueIndex("settlement_origin_created_unique").on(table.originType, table.originId, table.createdAt),
]);

export const brokerCommissionPayments = sqliteTable("broker_commission_payments", {
  id: text("id").primaryKey(),
  brokerId: text("broker_id").notNull().references(() => brokers.id),
  bankTransactionId: text("bank_transaction_id").notNull().references(() => bankTransactions.id),
  amountCents: integer("amount_cents").notNull(),
  operationKey: text("operation_key"),
  paymentDate: text("payment_date").notNull(),
  method: text("method", { enum: ["PIX", "TED", "CHECK", "DEBIT", "CASH", "TRANSFER", "OTHER"] }).notNull(),
  document: text("document"),
  notes: text("notes"),
  ...timestamps,
}, (table) => [
  uniqueIndex("broker_payment_bank_transaction_unique").on(table.bankTransactionId),
  uniqueIndex("broker_payment_operation_key_unique").on(table.operationKey),
  index("broker_payments_broker_idx").on(table.brokerId),
]);

export const inventorySettings = sqliteTable("inventory_settings", {
  id: text("id").primaryKey(),
  startMonth: text("start_month").notNull(),
  openingKilogramsMilli: integer("opening_kilograms_milli").notNull(),
  openingValueCents: integer("opening_value_cents").notNull(),
  ...timestamps,
});

export const inventoryMonthClosings = sqliteTable("inventory_month_closings", {
  month: text("month").primaryKey(),
  closingKilogramsMilli: integer("closing_kilograms_milli").notNull(),
  closingPricePerSackCents: integer("closing_price_per_sack_cents").notNull().default(0),
  ...timestamps,
});

export const chequeBatches = sqliteTable("cheque_batches", {
  id: text("id").primaryKey(),
  receivedFromPersonId: text("received_from_person_id").references(() => people.id),
  receivedAt: text("received_at").notNull(),
  notes: text("notes"),
  ...timestamps,
});

export const cheques = sqliteTable("cheques", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").references(() => chequeBatches.id, { onDelete: "set null" }),
  operationKey: text("operation_key").notNull(),
  bankName: text("bank_name").notNull(),
  agency: text("agency"),
  accountNumber: text("account_number"),
  checkNumber: text("check_number").notNull(),
  issuerName: text("issuer_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  receivedAt: text("received_at").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["IN_PORTFOLIO", "POSTDATED", "DEPOSITED", "CLEARED", "RETURNED", "TRANSFERRED", "CANCELLED"] }).notNull(),
  imageKey: text("image_key"),
  ocrConfidence: integer("ocr_confidence"),
  receiptOriginType: text("receipt_origin_type", { enum: ["INSTALLMENT", "GENERAL_ENTRY"] }),
  receiptOriginId: text("receipt_origin_id"),
  transferOriginType: text("transfer_origin_type", { enum: ["INSTALLMENT", "GENERAL_ENTRY"] }),
  transferOriginId: text("transfer_origin_id"),
  bankTransactionId: text("bank_transaction_id").references(() => bankTransactions.id),
  notes: text("notes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  uniqueIndex("cheques_operation_key_unique").on(table.operationKey),
  uniqueIndex("cheques_identity_unique").on(table.bankName, table.agency, table.accountNumber, table.checkNumber),
  index("cheques_active_status_due_idx").on(table.active, table.status, table.dueDate),
]);

export const chequeEvents = sqliteTable("cheque_events", {
  id: text("id").primaryKey(),
  chequeId: text("cheque_id").notNull().references(() => cheques.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: ["RECEIVED", "DEPOSITED", "CLEARED", "RETURNED", "TRANSFERRED", "RECOVERED", "CANCELLED", "UPDATED"] }).notNull(),
  eventDate: text("event_date").notNull(),
  bankAccountId: text("bank_account_id").references(() => bankAccounts.id),
  personId: text("person_id").references(() => people.id),
  notes: text("notes"),
  ...timestamps,
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(),
  action: text("action").notNull(), beforeData: text("before_data"), afterData: text("after_data"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("audit_logs_entity_created_idx").on(table.entityType, table.entityId, table.createdAt)]);

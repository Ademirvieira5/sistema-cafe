-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personType" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "cpfCnpj" TEXT,
    "rgIe" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "zipCode" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "PersonRole" (
    "personId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    PRIMARY KEY ("personId", "role"),
    CONSTRAINT "PersonRole_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Broker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "cpfCnpj" TEXT,
    "rgIe" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "pixKey" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankCode" TEXT,
    "bankName" TEXT NOT NULL,
    "agency" TEXT,
    "accountNumber" TEXT NOT NULL,
    "accountDigit" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "openingBalance" DECIMAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" TEXT,
    "afterData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Person_cpfCnpj_key" ON "Person"("cpfCnpj");
CREATE INDEX "Person_legalName_idx" ON "Person"("legalName");
CREATE INDEX "Person_active_idx" ON "Person"("active");
CREATE INDEX "PersonRole_role_idx" ON "PersonRole"("role");
CREATE UNIQUE INDEX "Broker_cpfCnpj_key" ON "Broker"("cpfCnpj");
CREATE INDEX "Broker_name_idx" ON "Broker"("name");
CREATE INDEX "Broker_active_idx" ON "Broker"("active");
CREATE UNIQUE INDEX "FinancialCategory_code_key" ON "FinancialCategory"("code");
CREATE UNIQUE INDEX "FinancialCategory_name_type_key" ON "FinancialCategory"("name", "type");
CREATE INDEX "FinancialCategory_active_idx" ON "FinancialCategory"("active");
CREATE UNIQUE INDEX "BankAccount_bankName_agency_accountNumber_accountDigit_key" ON "BankAccount"("bankName", "agency", "accountNumber", "accountDigit");
CREATE INDEX "BankAccount_active_idx" ON "BankAccount"("active");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");


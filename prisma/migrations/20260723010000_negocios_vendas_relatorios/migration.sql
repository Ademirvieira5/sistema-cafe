ALTER TABLE "Purchase" ADD COLUMN "businessType" TEXT NOT NULL DEFAULT 'PURCHASE';
CREATE INDEX "Purchase_businessType_date_idx" ON "Purchase"("businessType", "date");
CREATE TABLE "GeneralEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "direction" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "personId" TEXT,
  "dueDate" DATETIME NOT NULL,
  "amount" DECIMAL NOT NULL,
  "paidAmount" DECIMAL NOT NULL DEFAULT 0,
  "fixedMonthly" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "GeneralEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GeneralEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "GeneralEntry_direction_dueDate_idx" ON "GeneralEntry"("direction", "dueDate");
CREATE INDEX "GeneralEntry_categoryId_idx" ON "GeneralEntry"("categoryId");
CREATE INDEX "GeneralEntry_personId_idx" ON "GeneralEntry"("personId");

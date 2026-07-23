CREATE TABLE "Purchase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sequence" INTEGER NOT NULL,
  "date" DATETIME NOT NULL,
  "supplierId" TEXT NOT NULL,
  "kilograms" DECIMAL NOT NULL,
  "sacks" DECIMAL NOT NULL,
  "pricePerSack" DECIMAL NOT NULL,
  "grossAmount" DECIMAL NOT NULL,
  "adjustmentAmount" DECIMAL NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL NOT NULL,
  "brokerId" TEXT,
  "commissionPercent" DECIMAL,
  "commissionAmount" DECIMAL NOT NULL DEFAULT 0,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Purchase_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "PurchaseInstallment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "purchaseId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "dueDate" DATETIME NOT NULL,
  "amount" DECIMAL NOT NULL,
  "paidAmount" DECIMAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PurchaseInstallment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Purchase_sequence_key" ON "Purchase"("sequence");
CREATE INDEX "Purchase_date_idx" ON "Purchase"("date");
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");
CREATE INDEX "Purchase_brokerId_idx" ON "Purchase"("brokerId");
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");
CREATE UNIQUE INDEX "PurchaseInstallment_purchaseId_number_key" ON "PurchaseInstallment"("purchaseId", "number");
CREATE INDEX "PurchaseInstallment_dueDate_idx" ON "PurchaseInstallment"("dueDate");

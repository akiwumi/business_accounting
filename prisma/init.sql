-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "orgType" TEXT NOT NULL DEFAULT 'sole_trader',
    "jurisdiction" TEXT NOT NULL DEFAULT 'SWEDEN',
    "bookkeepingMethod" TEXT NOT NULL DEFAULT 'kontantmetoden',
    "vatRegistered" BOOLEAN NOT NULL DEFAULT true,
    "vatFrequency" TEXT NOT NULL DEFAULT 'yearly',
    "fiscalYearStart" DATETIME NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'SEK',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "sniCode" TEXT,
    "vatNumber" TEXT,
    "fSkattRegistered" BOOLEAN NOT NULL DEFAULT true,
    "personnummer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TaxConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "municipalTaxRate" DECIMAL NOT NULL DEFAULT 0.32,
    "socialContributionRate" DECIMAL NOT NULL DEFAULT 0.2897,
    "generalDeductionRate" DECIMAL NOT NULL DEFAULT 0.25,
    "vatStandardRate" DECIMAL NOT NULL DEFAULT 0.25,
    "vatReducedRateFood" DECIMAL NOT NULL DEFAULT 0.12,
    "vatReducedRateCulture" DECIMAL NOT NULL DEFAULT 0.06,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "vatCode" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "vendor" TEXT,
    "itemPurchased" TEXT,
    "receiptDate" DATETIME,
    "grossAmount" DECIMAL,
    "netAmount" DECIMAL,
    "vatAmount" DECIMAL,
    "vatRate" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "category" TEXT,
    "confidence" DECIMAL,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Receipt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "receiptId" TEXT,
    "txnDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "grossAmount" DECIMAL NOT NULL,
    "netAmount" DECIMAL NOT NULL,
    "vatAmount" DECIMAL NOT NULL,
    "vatRate" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "source" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL NOT NULL DEFAULT 0,
    "credit" DECIMAL NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "JournalLine_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedRows" INTEGER NOT NULL,
    "acceptedRows" INTEGER NOT NULL,
    "rejectedRows" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankImportBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankImportRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "txnDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "transactionId" TEXT,
    CONSTRAINT "BankImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BankImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankImportRow_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'equipment',
    "acquisitionDate" DATETIME NOT NULL,
    "acquisitionCost" DECIMAL NOT NULL,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'declining_30',
    "disposalDate" DATETIME,
    "disposalValue" DECIMAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FixedAsset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MileageEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "tripDate" DATETIME NOT NULL,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "kilometers" DECIMAL NOT NULL,
    "ratePerKm" DECIMAL NOT NULL DEFAULT 1.85,
    "deductionAmount" DECIMAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MileageEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PeriodisationEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PeriodisationEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxConfig_businessId_key" ON "TaxConfig"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_businessId_code_key" ON "Account"("businessId", "code");

-- CreateIndex
CREATE INDEX "FixedAsset_businessId_idx" ON "FixedAsset"("businessId");

-- CreateIndex
CREATE INDEX "MileageEntry_businessId_tripDate_idx" ON "MileageEntry"("businessId", "tripDate");

-- CreateIndex
CREATE INDEX "PeriodisationEntry_businessId_taxYear_idx" ON "PeriodisationEntry"("businessId", "taxYear");

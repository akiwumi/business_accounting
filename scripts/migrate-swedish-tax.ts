/**
 * migrate-swedish-tax.ts
 *
 * Applies the Swedish tax feature migration to the existing SQLite database.
 * Run with: npx tsx scripts/migrate-swedish-tax.ts
 *
 * This script is idempotent – safe to run multiple times.
 */

import { prisma } from "../lib/db";

async function migrate() {
  console.log("▶ Running Swedish tax feature migration…");

  // SQLite does not support IF NOT EXISTS on ALTER TABLE,
  // so we check the schema first and only add missing columns.
  const tableInfo = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA table_info("Business")`
  );
  const existingCols = tableInfo.map((r) => r.name);

  const newCols: Array<[string, string]> = [
    ["sniCode", "TEXT"],
    ["vatNumber", "TEXT"],
    ["fSkattRegistered", "BOOLEAN NOT NULL DEFAULT 1"],
    ["personnummer", "TEXT"]
  ];

  for (const [col, type] of newCols) {
    if (!existingCols.includes(col)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN "${col}" ${type}`);
      console.log(`  + Business.${col} added`);
    } else {
      console.log(`  ✓ Business.${col} already exists`);
    }
  }

  // Check and create FixedAsset table
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table'`
  );
  const tableNames = tables.map((t) => t.name);

  if (!tableNames.includes("FixedAsset")) {
    await prisma.$executeRawUnsafe(`
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
        CONSTRAINT "FixedAsset_businessId_fkey"
          FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX "FixedAsset_businessId_idx" ON "FixedAsset"("businessId")`);
    console.log("  + FixedAsset table created");
  } else {
    console.log("  ✓ FixedAsset table already exists");
  }

  if (!tableNames.includes("MileageEntry")) {
    await prisma.$executeRawUnsafe(`
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
        CONSTRAINT "MileageEntry_businessId_fkey"
          FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "MileageEntry_businessId_tripDate_idx" ON "MileageEntry"("businessId", "tripDate")`
    );
    console.log("  + MileageEntry table created");
  } else {
    console.log("  ✓ MileageEntry table already exists");
  }

  if (!tableNames.includes("PeriodisationEntry")) {
    await prisma.$executeRawUnsafe(`
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
        CONSTRAINT "PeriodisationEntry_businessId_fkey"
          FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX "PeriodisationEntry_businessId_taxYear_idx" ON "PeriodisationEntry"("businessId", "taxYear")`
    );
    console.log("  + PeriodisationEntry table created");
  } else {
    console.log("  ✓ PeriodisationEntry table already exists");
  }

  console.log("\n✅ Migration complete. All new tables and columns are in place.");
  await prisma.$disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

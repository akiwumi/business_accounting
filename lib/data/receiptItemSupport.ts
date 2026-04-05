import { prisma } from "@/lib/db";

let cachedSupport: boolean | null = null;

const isMissingItemPurchasedFieldError = (message: string) => {
  const lower = message.toLowerCase();
  if (message.includes("Unknown field `itemPurchased`")) return true;
  return (
    lower.includes("itempurchased") &&
    (lower.includes("does not exist") || lower.includes("no such column"))
  );
};

export const supportsReceiptItemPurchasedField = async () => {
  if (cachedSupport !== null) return cachedSupport;

  try {
    await prisma.receipt.findFirst({
      select: {
        id: true,
        itemPurchased: true
      }
    });
    cachedSupport = true;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingItemPurchasedFieldError(message)) {
      cachedSupport = false;
      return false;
    }
    throw error;
  }
};

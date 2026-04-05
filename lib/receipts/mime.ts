const extensionToMime: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf"
};

const inferFromFileName = (fileName: string) => {
  const lower = fileName.toLowerCase();
  const entry = Object.entries(extensionToMime).find(([ext]) => lower.endsWith(ext));
  return entry?.[1] ?? null;
};

export const inferReceiptMimeType = (fileName: string, mimeType?: string | null) => {
  const normalized = (mimeType || "").trim().toLowerCase();
  if (normalized && normalized !== "application/octet-stream" && normalized !== "binary/octet-stream") {
    if (normalized === "image/jpg") return "image/jpeg";
    return normalized;
  }

  const inferred = inferFromFileName(fileName);
  return inferred ?? "application/octet-stream";
};

export const isReceiptImageMimeType = (mimeType: string) => mimeType.toLowerCase().startsWith("image/");


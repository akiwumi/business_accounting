import { createWorker, PSM } from "tesseract.js";

const normalize = (value) =>
  String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

const scoreText = (text) => {
  const compact = String(text || "").replace(/\s+/g, "");
  const letters = (compact.match(/[A-Za-zÅÄÖåäö]/g) || []).length;
  const digits = (compact.match(/\d/g) || []).length;
  return letters + digits * 2;
};

const runModesWithWorker = async (worker, imagePath) => {
  const candidates = [];
  const modes = [PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT];

  for (const mode of modes) {
    try {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
        tessedit_pageseg_mode: mode
      });
      const result = await worker.recognize(imagePath);
      const text = normalize(result?.data?.text || "");
      if (text) candidates.push(text);
    } catch {
      // Try the next mode.
    }
  }

  if (candidates.length === 0) return "";
  candidates.sort((a, b) => scoreText(b) - scoreText(a));
  return candidates[0];
};

const run = async () => {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Missing image path.");
    process.exit(1);
  }

  // Prefer the local `eng.traineddata` in project root when available.
  const workerWithLocalLang = await createWorker("eng", 1, {
    langPath: process.cwd(),
    gzip: false
  });

  let best = "";
  try {
    best = await runModesWithWorker(workerWithLocalLang, imagePath);
  } finally {
    await workerWithLocalLang.terminate();
  }

  if (best) {
    process.stdout.write(best);
    return;
  }

  const fallbackWorker = await createWorker("eng");
  try {
    best = await runModesWithWorker(fallbackWorker, imagePath);
  } finally {
    await fallbackWorker.terminate();
  }

  process.stdout.write(best || "");
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "OCR script failed.");
  process.exit(1);
});

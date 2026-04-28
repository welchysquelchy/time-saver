import Tesseract from "tesseract.js";

export type OCRProgressUpdate = {
  status: string;
  progress: number;
};

export async function extractTextFromImage(
  file: File,
  onProgress?: (update: OCRProgressUpdate) => void
): Promise<string> {
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (message) => {
      if (!onProgress) {
        return;
      }
      onProgress({
        status: message.status,
        progress: Math.round((message.progress || 0) * 100),
      });
    },
  });

  try {
    const result = await worker.recognize(file);
    return result.data.text.replace(/\r/g, "").trim();
  } finally {
    await worker.terminate();
  }
}

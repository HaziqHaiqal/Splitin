const SIZES = [1600, 800];

export async function readQr(file: File): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const bitmap = await createImageBitmap(file);
  try {
    for (const longest of SIZES) {
      const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const found = jsQR(context.getImageData(0, 0, width, height).data, width, height, {
        inversionAttempts: "attemptBoth",
      });
      if (found?.data) return found.data;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

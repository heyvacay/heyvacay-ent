'use client';

/**
 * Downscale + re-encode an image (data URL) to a small JPEG so it fits well
 * under DynamoDB's 400 KB per-item limit and doesn't blow the localStorage
 * quota. Receipts don't need full resolution to be readable.
 *
 * Targets the longest edge at `maxDim` and drops quality until the result is
 * under `maxBytes`. Falls back to the original on any failure.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  { maxDim = 1400, maxBytes = 300_000, minQuality = 0.4 }: { maxDim?: number; maxBytes?: number; minQuality?: number } = {}
): Promise<string> {
  try {
    if (!dataUrl.startsWith('data:image/')) return dataUrl;
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    // White backdrop so transparent PNG receipts don't go black as JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    let quality = 0.72;
    let out = canvas.toDataURL('image/jpeg', quality);
    while (approxBytes(out) > maxBytes && quality > minQuality) {
      quality -= 0.12;
      out = canvas.toDataURL('image/jpeg', quality);
    }
    // Only use the compressed version if it's actually smaller.
    return approxBytes(out) < approxBytes(dataUrl) ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Rough byte size of a data URL from its base64 payload length. */
function approxBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

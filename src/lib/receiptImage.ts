import { parseEInvoiceQR, parseReceiptText, type ReceiptScan } from './receipt';

/**
 * 收據影像處理，全部在手機本機執行，照片不會送去任何辨識服務。
 * 先掃電子發票 QR Code（快又準）；掃不到才載入文字辨識（第一次使用會下載約數 MB 的中文字庫）。
 */
async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    // decode 完成後圖片已在記憶體，可以釋放網址。
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function drawRegion(image: HTMLImageElement, region: { x: number; y: number; w: number; h: number }, maxSide: number) {
  const sx = image.naturalWidth * region.x;
  const sy = image.naturalHeight * region.y;
  const sw = image.naturalWidth * region.w;
  const sh = image.naturalHeight * region.h;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('無法處理影像');
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

async function scanQR(image: HTMLImageElement): Promise<ReceiptScan | null> {
  const { default: jsQR } = await import('jsqr');
  // 左側 QR 在發票左半邊；整張找不到時再單看左半、上半，提高命中率。
  const regions = [
    { x: 0, y: 0, w: 1, h: 1 },
    { x: 0, y: 0, w: 0.6, h: 1 },
    { x: 0, y: 0.3, w: 0.6, h: 0.7 },
    { x: 0, y: 0, w: 1, h: 0.6 }
  ];
  for (const region of regions) {
    for (const maxSide of [1600, 900]) {
      const { canvas, context } = drawRegion(image, region, maxSide);
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' });
      const parsed = code ? parseEInvoiceQR(code.data) : null;
      if (parsed) return parsed;
    }
  }
  return null;
}

async function scanText(image: HTMLImageElement, onProgress?: (ratio: number) => void): Promise<ReceiptScan> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['chi_tra', 'eng'], undefined, {
    logger: (message: { status: string; progress: number }) => {
      if (message.status === 'recognizing text') onProgress?.(message.progress);
    }
  });
  try {
    const { canvas } = drawRegion(image, { x: 0, y: 0, w: 1, h: 1 }, 1600);
    const { data } = await worker.recognize(canvas);
    return parseReceiptText(data.text);
  } finally {
    await worker.terminate();
  }
}

export async function scanReceipt(file: File, onStage?: (stage: 'qr' | 'ocr', progress?: number) => void): Promise<ReceiptScan> {
  const image = await loadImage(file);
  onStage?.('qr');
  const qr = await scanQR(image);
  if (qr) return qr;
  onStage?.('ocr', 0);
  return scanText(image, (progress) => onStage?.('ocr', progress));
}

/** 壓縮成長邊 1280px 的 JPEG，存收據照片用。 */
export async function compressReceipt(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const { canvas } = drawRegion(image, { x: 0, y: 0, w: 1, h: 1 }, 1280);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('壓縮照片失敗'))), 'image/jpeg', 0.75);
  });
}

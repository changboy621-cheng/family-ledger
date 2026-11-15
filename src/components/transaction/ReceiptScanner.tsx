import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import type { ReceiptScan } from '../../lib/receipt';

interface ReceiptScannerProps {
  /** 辨識完成：帶回找到的欄位（可能部分或全部缺）。 */
  onScanned: (scan: ReceiptScan, file: File) => void;
  /** 目前附著的照片（要存在交易上）。 */
  file: File | null;
  keepPhoto: boolean;
  onKeepPhotoChange: (keep: boolean) => void;
  onClear: () => void;
}

/**
 * 「拍收據」：先掃電子發票 QR Code，掃不到再本機文字辨識，結果帶入金額／日期。
 * 全程在手機上處理，照片只有在勾選「保存照片」時才會上傳到自己的帳本空間。
 */
export function ReceiptScanner({ onScanned, file, keepPhoto, onKeepPhotoChange, onClear }: ReceiptScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'idle' | 'qr' | 'ocr'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  async function handleFile(next: File) {
    setMessage('');
    setStage('qr');
    try {
      const { scanReceipt } = await import('../../lib/receiptImage');
      const scan = await scanReceipt(next, (nextStage, ratio) => {
        setStage(nextStage);
        if (ratio !== undefined) setProgress(ratio);
      });
      onScanned(scan, next);
      const found = [scan.amount ? '金額' : '', scan.date ? '日期' : '', scan.invoiceNumber ? '發票號碼' : ''].filter(Boolean);
      setMessage(
        found.length > 0
          ? `${scan.source === 'qr' ? '已讀取發票 QR Code' : '已辨識收據文字'}，帶入${found.join('、')}，請核對。`
          : '看不出金額，照片已附上，請手動輸入。'
      );
    } catch (error) {
      console.error('收據辨識失敗', error);
      setMessage('辨識失敗，照片已附上，請手動輸入。');
      onScanned({ source: 'ocr' }, next);
    } finally {
      setStage('idle');
    }
  }

  const busy = stage !== 'idle';

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) void handleFile(next);
          event.target.value = '';
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-card px-4 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-60"
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {stage === 'qr' ? '讀取中…' : stage === 'ocr' ? `辨識文字 ${Math.round(progress * 100)}%` : file ? '重拍收據' : '拍收據'}
        </button>
        {file && !busy ? (
          <>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={keepPhoto} onChange={(event) => onKeepPhotoChange(event.target.checked)} />
              保存照片
            </label>
            <button
              type="button"
              className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              aria-label="移除收據照片"
              onClick={() => {
                setMessage('');
                onClear();
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>
      {stage === 'ocr' ? <p className="text-xs text-slate-500">沒有發票 QR Code，改用文字辨識；第一次會下載中文字庫，請稍候。</p> : null}
      {message ? <p className="text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}

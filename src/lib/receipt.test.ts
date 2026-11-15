import { describe, expect, it } from 'vitest';
import { parseEInvoiceQR, parseReceiptText } from './receipt';

describe('parseEInvoiceQR', () => {
  // 合成的示範 QR 內容：AB12345678、民國 115/11/12、隨機碼 1234、未稅 0x1C2(450)、含稅 0x1E6(486)。
  const qr = 'AB12345678' + '1151112' + '1234' + '000001C2' + '000001E6' + '00000000' + '12345678' + 'A'.repeat(24) + ':**********:2:2:1:鮮奶:1:99';

  it('取出發票號碼、日期、含稅總額', () => {
    expect(parseEInvoiceQR(qr)).toEqual({ invoiceNumber: 'AB12345678', date: '2026-11-12', amount: 486, source: 'qr' });
  });

  it('右側 QR（** 開頭）或亂碼回傳 null', () => {
    expect(parseEInvoiceQR('**:鮮奶:1:99')).toBeNull();
    expect(parseEInvoiceQR('https://example.test')).toBeNull();
  });
});

describe('parseReceiptText', () => {
  it('從總計行取金額、辨識西元日期與發票號碼', () => {
    const text = ['示範商店', '2026/11/12 18:30', 'AB-12345678', '鮮奶 99', '小計 486', '總 計 $1,486'].join('\n');
    expect(parseReceiptText(text)).toEqual({ source: 'ocr', amount: 1486, date: '2026-11-12', invoiceNumber: 'AB12345678' });
  });

  it('民國日期、全形數字', () => {
    const text = ['115年11月3日', '合計 ３２０元'].join('\n');
    expect(parseReceiptText(text)).toEqual({ source: 'ocr', amount: 320, date: '2026-11-03' });
  });

  it('看不出來就不回傳欄位', () => {
    expect(parseReceiptText('謝謝光臨')).toEqual({ source: 'ocr' });
  });
});

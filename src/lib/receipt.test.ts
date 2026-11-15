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

  // 以下為合成的 OCR 文字，重現實際會抓錯金額的版面。
  it.each([
    ['總計後面有找零金額', ['總計 486', '收現金額 500', '找零金額 14'], 486],
    ['總計後面有未稅金額、稅額', ['總計 525', '未稅金額 500', '稅額 25'], 525],
    ['SUBTOTAL 不當成 TOTAL', ['TOTAL 486', 'SUBTOTAL 450'], 486],
    ['小計印在總計之後', ['總計 486', '小計 450'], 486],
    ['金額被拆到下一行', ['總計', '$486'], 486],
    ['千分位逗號後多了空白', ['總計 1, 486'], 1486],
    ['同一行後面接統編', ['總計 486 統編 04123456'], 486],
    ['同一行後面接找零', ['總計 486 找零 14'], 486],
    ['0 被認成 O', ['總計 4O6'], 406]
  ])('%s', (_name, lines, expected) => {
    expect(parseReceiptText(lines.join('\n')).amount).toBe(expected);
  });

  it('看不出來就不回傳欄位', () => {
    expect(parseReceiptText('謝謝光臨')).toEqual({ source: 'ocr' });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatPlaceName, reverseGeocode } from './geocode';

describe('formatPlaceName', () => {
  it('店名＋區域；台灣不加國名', () => {
    expect(
      formatPlaceName({ name: '全聯福利中心', address: { city_district: '大安區', country_code: 'tw', country: '臺灣' } })
    ).toBe('全聯福利中心・大安區');
  });
  it('沒有店名時用路名；境外加國名', () => {
    expect(
      formatPlaceName({ address: { road: '銀座通り', suburb: '中央区', country_code: 'jp', country: '日本' } })
    ).toBe('銀座通り・中央区・日本');
  });
  it('什麼都沒有回傳 null', () => {
    expect(formatPlaceName({})).toBeNull();
  });
});

describe('reverseGeocode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('只送出經緯度並回傳地名', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: '東京車站', address: { city: '千代田区', country_code: 'jp', country: '日本' } })
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await reverseGeocode({ latitude: 35.68, longitude: 139.76 })).toBe('東京車站・千代田区・日本');
    expect(fetchMock.mock.calls[0][0]).toContain('lat=35.68&lon=139.76');
  });

  it('網路錯誤或非 2xx 回傳 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await reverseGeocode({ latitude: 1, longitude: 2 })).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await reverseGeocode({ latitude: 1, longitude: 2 })).toBeNull();
  });
});

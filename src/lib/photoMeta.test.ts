import { describe, expect, it, vi } from 'vitest';

const { parse, gps } = vi.hoisted(() => ({ parse: vi.fn(), gps: vi.fn() }));
vi.mock('exifr', () => ({ default: { parse, gps } }));

import { readPhotoMeta } from './photoMeta';

const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' });

describe('readPhotoMeta', () => {
  it('讀出座標（取到 6 位）與拍攝日期', async () => {
    gps.mockResolvedValue({ latitude: 35.6812364, longitude: 139.7671248 });
    parse.mockResolvedValue({ DateTimeOriginal: new Date(2026, 9, 3, 12, 30) });
    expect(await readPhotoMeta(file)).toEqual({
      coordinates: { latitude: 35.681236, longitude: 139.767125 },
      date: '2026-10-03'
    });
  });

  it('沒有 GPS 時座標為 null；解析丟錯也不往外丟', async () => {
    gps.mockResolvedValue(undefined);
    parse.mockResolvedValue(undefined);
    expect(await readPhotoMeta(file)).toEqual({ coordinates: null, date: null });
    parse.mockRejectedValue(new Error('bad'));
    expect(await readPhotoMeta(file)).toEqual({ coordinates: null, date: null });
  });
});

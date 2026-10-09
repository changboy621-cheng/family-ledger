// 從照片（收據、店面）的 EXIF 讀出拍攝地點與時間，用來幫記帳帶入位置與日期。
// 照片只在本機解析，不會上傳。
import { format } from 'date-fns';
import { isValidCoordinates, roundCoordinate, type Coordinates } from './geo';

export interface PhotoMeta {
  coordinates: Coordinates | null;
  /** 拍攝日期（YYYY-MM-DD，當地時間）；照片沒有時間資訊則為 null。 */
  date: string | null;
}

/** 讀取照片 EXIF；解析失敗或沒有資料時回傳空結果而不丟錯（很多照片本來就沒有 GPS）。 */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    const { default: exifr } = await import('exifr');
    const data = await exifr.parse(file, { gps: true, pick: ['DateTimeOriginal', 'CreateDate'] });
    const gps = await exifr.gps(file);
    const coordinates =
      gps && isValidCoordinates(gps.latitude, gps.longitude)
        ? { latitude: roundCoordinate(gps.latitude), longitude: roundCoordinate(gps.longitude) }
        : null;
    const taken: unknown = data?.DateTimeOriginal ?? data?.CreateDate;
    const date = taken instanceof Date && !Number.isNaN(taken.getTime()) ? format(taken, 'yyyy-MM-dd') : null;
    return { coordinates, date };
  } catch (error) {
    console.warn('[photoMeta] 讀取照片資訊失敗', error);
    return { coordinates: null, date: null };
  }
}

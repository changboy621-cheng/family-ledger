// 記帳定位與消費地圖的純邏輯：取得目前位置、把有定位的支出聚合成地圖上的地點。
import type { CurrencySummary, Transaction } from '../types';
import { emptyCurrencySummary } from './currency';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** 座標存到小數 6 位（約 0.1 公尺），與資料庫 numeric(9,6) 一致。 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function isValidCoordinates(latitude: unknown, longitude: unknown): latitude is number {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

export type LocationErrorKind = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class LocationError extends Error {
  constructor(public kind: LocationErrorKind) {
    super(kind);
  }
}

const LOCATION_ERROR_MESSAGES: Record<LocationErrorKind, string> = {
  unsupported: '這個裝置或瀏覽器不支援定位。',
  denied: '沒有取得定位權限，請到瀏覽器／系統設定允許「家帳」使用位置。',
  unavailable: '目前抓不到位置，請稍後再試。',
  timeout: '定位逾時，請到訊號較好的地方再試一次。'
};

export function locationErrorMessage(error: unknown): string {
  return error instanceof LocationError ? LOCATION_ERROR_MESSAGES[error.kind] : LOCATION_ERROR_MESSAGES.unavailable;
}

/** 取得目前位置；失敗時丟出 LocationError（呼叫端用 locationErrorMessage 轉成中文）。 */
export function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new LocationError('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude)
        }),
      (error) =>
        reject(new LocationError(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  });
}

export interface MapPlace {
  /** 聚合後的鍵：四捨五入到 CLUSTER_DECIMALS 位的 "lat,lng"。 */
  key: string;
  latitude: number;
  longitude: number;
  /** 該地點最常用的名稱；沒有名稱時為 null。 */
  name: string | null;
  count: number;
  totals: CurrencySummary;
  lastDate: string;
  transactions: Transaction[];
}

/** 約 1.1 公里的網格：同一間店／同一個商圈的多筆消費合併成一個點。 */
const CLUSTER_DECIMALS = 2;

/** 把有定位的支出聚合成地點，依消費筆數由多到少排序（同筆數則較新者在前）。 */
export function buildMapPlaces(transactions: Transaction[]): MapPlace[] {
  const groups = new Map<
    string,
    { latSum: number; lngSum: number; names: Map<string, number>; place: MapPlace }
  >();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const { latitude, longitude } = transaction;
    if (latitude == null || longitude == null || !isValidCoordinates(latitude, longitude)) continue;

    const key = `${latitude.toFixed(CLUSTER_DECIMALS)},${longitude.toFixed(CLUSTER_DECIMALS)}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        latSum: 0,
        lngSum: 0,
        names: new Map(),
        place: {
          key,
          latitude,
          longitude,
          name: null,
          count: 0,
          totals: emptyCurrencySummary(),
          lastDate: '',
          transactions: []
        }
      };
      groups.set(key, group);
    }
    group.latSum += latitude;
    group.lngSum += longitude;
    group.place.count += 1;
    group.place.totals[transaction.currency] += Number(transaction.amount);
    if (transaction.transaction_date > group.place.lastDate) group.place.lastDate = transaction.transaction_date;
    group.place.transactions.push(transaction);
    const name = transaction.place_name?.trim();
    if (name) group.names.set(name, (group.names.get(name) ?? 0) + 1);
  }

  return [...groups.values()]
    .map(({ latSum, lngSum, names, place }) => {
      const topName = [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        ...place,
        latitude: roundCoordinate(latSum / place.count),
        longitude: roundCoordinate(lngSum / place.count),
        name: topName
      };
    })
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate));
}

/** 圓點半徑（px）：依該地點金額相對最大值縮放，避免一筆大額蓋掉整張地圖。 */
export function markerRadius(value: number, max: number, min = 6, maxRadius = 28): number {
  if (max <= 0 || value <= 0) return min;
  return Math.round(min + (maxRadius - min) * Math.sqrt(Math.min(value / max, 1)));
}

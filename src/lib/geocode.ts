// 座標 → 地名（反向地理編碼），使用 OpenStreetMap Nominatim。
// 只會送出經緯度，不含金額、備註等其他資料；失敗時回傳 null，讓使用者自己填地名。
import type { Coordinates } from './geo';

interface NominatimResponse {
  name?: string;
  address?: Record<string, string | undefined>;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

/** 把 Nominatim 回應整理成短地名，例如「全聯福利中心・大安區」；境外再加國名。 */
export function formatPlaceName(data: NominatimResponse): string | null {
  const address = data.address ?? {};
  const title = data.name?.trim() || address.road || address.neighbourhood || address.suburb;
  const locality =
    address.city_district ?? address.suburb ?? address.city ?? address.town ?? address.village ?? address.county;
  const country = address.country_code?.toLowerCase() === 'tw' ? undefined : address.country;
  const parts = [title, locality && locality !== title ? locality : undefined, country].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join('・') : null;
}

export async function reverseGeocode(
  { latitude, longitude }: Coordinates,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const url = `${ENDPOINT}?format=jsonv2&zoom=18&accept-language=zh-TW&lat=${latitude}&lon=${longitude}`;
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    return formatPlaceName((await response.json()) as NominatimResponse);
  } catch {
    return null;
  }
}

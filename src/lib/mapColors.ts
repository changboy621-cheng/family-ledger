import type { Currency } from '../types';
import type { MapPlace, MapSource } from './geo';

// 消費地圖的分色：依「項目」或依「帳本來源」。
// 家庭帳本的類別可自訂名稱，所以用名稱關鍵字歸到幾個固定色群；對不上的歸「其他」。

export type ColorGroupKey = 'food' | 'transport' | 'travel' | 'shopping' | 'home' | 'fun' | 'health' | 'education' | 'other';

export interface ColorGroup {
  key: ColorGroupKey;
  label: string;
  color: string;
  /** 類別名稱符合任一關鍵字就歸入此群；越前面的群優先。 */
  pattern: RegExp | null;
}

export const COLOR_GROUPS: readonly ColorGroup[] = [
  { key: 'travel', label: '旅遊', color: '#EF4444', pattern: /旅|機票|住宿|飯店|民宿|簽證|出國|行程|票券/ },
  { key: 'food', label: '餐飲食品', color: '#EAB308', pattern: /餐|飲|食|吃|咖啡|點心|宵夜|便當|零食|早午/ },
  { key: 'transport', label: '交通', color: '#3B82F6', pattern: /交通|車|油|捷運|高鐵|火車|公車|計程|停車|通勤/ },
  { key: 'shopping', label: '購物', color: '#A855F7', pattern: /購物|衣|服飾|美妝|百貨|3C|禮/ },
  { key: 'home', label: '居家生活', color: '#22C55E', pattern: /居家|生活|日用|水電|房租|家具|超市|網路|電信|訂閱/ },
  { key: 'fun', label: '娛樂', color: '#EC4899', pattern: /娛樂|電影|遊戲|運動|健身|門票/ },
  { key: 'health', label: '醫療', color: '#F97316', pattern: /醫|藥|健康|保險|看診/ },
  { key: 'education', label: '教育', color: '#06B6D4', pattern: /教育|學|育兒|小孩|女兒|玩具|補習|書/ },
  { key: 'other', label: '其他', color: '#94A3B8', pattern: null }
];

const GROUP_BY_KEY = new Map(COLOR_GROUPS.map((group) => [group.key, group]));

export function colorGroup(key: ColorGroupKey): ColorGroup {
  return GROUP_BY_KEY.get(key) as ColorGroup;
}

/** 自訂類別名稱 → 色群。 */
export function groupForCategoryName(name: string | null | undefined): ColorGroupKey {
  const text = name?.trim();
  if (!text) return 'other';
  return COLOR_GROUPS.find((group) => group.pattern?.test(text))?.key ?? 'other';
}

/** 旅遊帳的固定分類 → 色群：住宿、門票娛樂視為「旅遊」，其餘對應一般項目。 */
const TRIP_CATEGORY_GROUP: Record<string, ColorGroupKey> = {
  food: 'food',
  snack: 'food',
  transport: 'transport',
  lodging: 'travel',
  sightseeing: 'travel',
  shopping: 'shopping',
  souvenir: 'shopping',
  other: 'other'
};

export function groupForTripCategory(key: string): ColorGroupKey {
  return TRIP_CATEGORY_GROUP[key] ?? 'other';
}

export const SOURCE_STYLE: Record<MapSource, { label: string; color: string }> = {
  family: { label: '家庭帳本', color: '#1D9E75' },
  personal: { label: '個人帳本', color: '#378ADD' },
  trip: { label: '旅遊', color: '#EF4444' }
};

export interface ColorSlice {
  key: string;
  label: string;
  color: string;
  amount: number;
  /** 佔該地點在指定幣別下總額的比例（0–1）。 */
  ratio: number;
}

/** 地點圓點的色塊：依項目或帳本來源拆開，金額大的在前；只含該幣別有金額的項目。 */
export function colorSlices(place: Pick<MapPlace, 'groupTotals' | 'sourceTotals'>, currency: Currency, colorBy: 'category' | 'source'): ColorSlice[] {
  const raw =
    colorBy === 'source'
      ? (Object.keys(SOURCE_STYLE) as MapSource[]).map((key) => ({
          key,
          label: SOURCE_STYLE[key].label,
          color: SOURCE_STYLE[key].color,
          amount: place.sourceTotals[key][currency]
        }))
      : COLOR_GROUPS.map((group) => ({
          key: group.key,
          label: group.label,
          color: group.color,
          amount: place.groupTotals[group.key]?.[currency] ?? 0
        }));
  const slices = raw.filter((slice) => slice.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  return slices.map((slice) => ({ ...slice, ratio: total > 0 ? slice.amount / total : 0 }));
}

/** 轉成 CSS conic-gradient（從正上方順時針）；單一色塊為純色。 */
export function sliceGradient(slices: ColorSlice[]): string {
  if (slices.length === 0) return COLOR_GROUPS[COLOR_GROUPS.length - 1].color;
  if (slices.length === 1) return slices[0].color;
  let start = 0;
  const stops = slices.map((slice, index) => {
    const end = index === slices.length - 1 ? 100 : start + slice.ratio * 100;
    const stop = `${slice.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

// 顯示名稱處理：去空白、收斂連續空白、限制長度。

export const MAX_DISPLAY_NAME_LENGTH = 20;

export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function isValidDisplayName(raw: string): boolean {
  return normalizeDisplayName(raw).length > 0;
}

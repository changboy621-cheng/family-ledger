// 最小可靠的 CSV 序列化／解析（支援逗號、引號跳脫、換行、BOM）。

function escapeField(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function toCSV(rows: string[][]): string {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n');
}

export function parseCSV(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
    } else if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else {
      field += char;
      i += 1;
    }
  }

  // 收尾最後一個欄位/列
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // 丟掉完全空白的列（例如尾端換行造成的空列）
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

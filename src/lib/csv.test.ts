import { describe, expect, it } from 'vitest';
import { parseCSV, toCSV } from './csv';

describe('toCSV', () => {
  it('一般欄位以逗號相接、列以換行相接', () => {
    expect(toCSV([['a', 'b'], ['1', '2']])).toBe('a,b\r\n1,2');
  });

  it('含逗號/引號/換行的欄位會加引號並跳脫', () => {
    expect(toCSV([['有,逗號', '有"引號']])).toBe('"有,逗號","有""引號"');
    expect(toCSV([['第一行\n第二行']])).toBe('"第一行\n第二行"');
  });
});

describe('parseCSV', () => {
  it('解析基本表格', () => {
    expect(parseCSV('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('解析含引號跳脫的欄位', () => {
    expect(parseCSV('"有,逗號","有""引號"')).toEqual([['有,逗號', '有"引號']]);
  });

  it('去除 BOM 並忽略空白尾列', () => {
    expect(parseCSV('﻿a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('round-trip：parse(toCSV(x)) 還原', () => {
    const rows = [['日期', '金額', '備註'], ['2026-06-19', '1099', '衛生紙, 兩串']];
    expect(parseCSV(toCSV(rows))).toEqual(rows);
  });
});

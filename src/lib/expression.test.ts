import { describe, expect, it } from 'vitest';
import { appendCalculatorKey, evaluateExpression, sanitizeExpressionInput } from './expression';

describe('evaluateExpression', () => {
  it('計算加減乘除', () => {
    expect(evaluateExpression('120+80')).toBe(200);
    expect(evaluateExpression('1000-200')).toBe(800);
    expect(evaluateExpression('50*3')).toBe(150);
    expect(evaluateExpression('100/4')).toBe(25);
  });

  it('遵守先乘除後加減', () => {
    expect(evaluateExpression('120+80*2')).toBe(280);
  });

  it('支援括號', () => {
    expect(evaluateExpression('(120+80)*2')).toBe(400);
  });

  it('支援小數與空白', () => {
    expect(evaluateExpression('850.8')).toBe(850.8);
    expect(evaluateExpression('12 + 3')).toBe(15);
  });

  it('純數字直接回傳', () => {
    expect(evaluateExpression('364')).toBe(364);
  });

  it('不完整或無效算式回傳 null', () => {
    expect(evaluateExpression('')).toBeNull();
    expect(evaluateExpression('12+')).toBeNull();
    expect(evaluateExpression('12++3')).toBeNull();
    expect(evaluateExpression('(1+2')).toBeNull();
    expect(evaluateExpression('abc')).toBeNull();
  });

  it('除以零回傳 null', () => {
    expect(evaluateExpression('10/0')).toBeNull();
  });
});

describe('sanitizeExpressionInput', () => {
  it('只保留數字與運算字元', () => {
    expect(sanitizeExpressionInput('12a+3b')).toBe('12+3');
    expect(sanitizeExpressionInput('100×2')).toBe('1002');
    expect(sanitizeExpressionInput('(50+50)/2')).toBe('(50+50)/2');
  });
});

describe('appendCalculatorKey', () => {
  const type = (keys: string) => [...keys].reduce((value, key) => appendCalculatorKey(value, key), '');

  it('開頭的 0 會被下一個數字取代', () => {
    expect(type('01')).toBe('1');
    expect(type('001')).toBe('1');
    expect(type('000')).toBe('0');
    expect(type('5+03')).toBe('5+3');
    expect(type('100')).toBe('100');
    expect(type('5+10')).toBe('5+10');
  });

  it('小數點：每個數字只能一個，開頭自動補 0', () => {
    expect(type('.5')).toBe('0.5');
    expect(type('0.5')).toBe('0.5');
    expect(type('1.2.3')).toBe('1.23');
    expect(type('5+.5')).toBe('5+0.5');
    expect(type('0.05')).toBe('0.05');
  });

  it('運算符號：開頭不能按，連按以後按的為準', () => {
    expect(type('+5')).toBe('5');
    expect(type('5+*3')).toBe('5*3');
    expect(type('5.+')).toBe('5+');
  });
});

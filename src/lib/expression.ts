// 安全的四則運算解析器（不使用 eval）：支援 + - * /、括號、小數。
// 用於金額欄位的計算機式輸入，無效或不完整算式回傳 null。

type Token = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'paren'; value: '(' | ')' };

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

/** 只保留數字與運算字元，供輸入時即時過濾。 */
export function sanitizeExpressionInput(value: string): string {
  return value.replace(/[^0-9.+\-*/() ]/g, '');
}

function tokenize(input: string): Token[] | null {
  const source = input.replace(/\s+/g, '');
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/[0-9.]/.test(char)) {
      let num = '';
      while (i < source.length && /[0-9.]/.test(source[i])) {
        num += source[i];
        i += 1;
      }
      if (num === '.' || (num.match(/\./g) ?? []).length > 1) return null;
      tokens.push({ type: 'num', value: Number(num) });
    } else if ('+-*/'.includes(char)) {
      tokens.push({ type: 'op', value: char });
      i += 1;
    } else if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      i += 1;
    } else {
      return null;
    }
  }

  return tokens;
}

function toRPN(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const operators: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'num') {
      output.push(token);
    } else if (token.type === 'op') {
      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (top.type === 'op' && PRECEDENCE[top.value] >= PRECEDENCE[token.value]) {
          output.push(operators.pop() as Token);
        } else {
          break;
        }
      }
      operators.push(token);
    } else if (token.value === '(') {
      operators.push(token);
    } else {
      let matched = false;
      while (operators.length > 0) {
        const top = operators.pop() as Token;
        if (top.type === 'paren' && top.value === '(') {
          matched = true;
          break;
        }
        output.push(top);
      }
      if (!matched) return null;
    }
  }

  while (operators.length > 0) {
    const top = operators.pop() as Token;
    if (top.type === 'paren') return null;
    output.push(top);
  }

  return output;
}

function evalRPN(rpn: Token[]): number | null {
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.type === 'num') {
      stack.push(token.value);
      continue;
    }

    if (stack.length < 2) return null;
    const b = stack.pop() as number;
    const a = stack.pop() as number;

    switch (token.value) {
      case '+':
        stack.push(a + b);
        break;
      case '-':
        stack.push(a - b);
        break;
      case '*':
        stack.push(a * b);
        break;
      case '/':
        if (b === 0) return null;
        stack.push(a / b);
        break;
      default:
        return null;
    }
  }

  if (stack.length !== 1) return null;
  return stack[0];
}

export function evaluateExpression(input: string): number | null {
  if (!input || !input.trim()) return null;

  const tokens = tokenize(input);
  if (!tokens || tokens.length === 0) return null;

  const rpn = toRPN(tokens);
  if (!rpn) return null;

  const result = evalRPN(rpn);
  if (result === null || !Number.isFinite(result)) return null;

  return result;
}

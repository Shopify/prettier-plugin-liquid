import { MatchResult } from 'ohm-js';
import lineColumn from 'line-column';

export function deepGet<T = any>(path: (string | number)[], obj: any): T {
  return path.reduce((curr: any, k: string | number) => {
    if (curr && curr[k] !== undefined) return curr[k];
    return undefined;
  }, obj);
}

export function length(x: any[]): number {
  return x.length;
}

export function dropLast<T>(n: number, xs: readonly T[]) {
  const result = [...xs];
  for (let i = 0; i < n; i++) {
    result.pop();
  }
  return result;
}

interface LineColPosition {
  line: number;
  column: number;
}

export class LiquidHTMLCSTParsingError extends SyntaxError {
  loc?: { start: LineColPosition; end: LineColPosition };

  constructor(ohm: MatchResult) {
    super(ohm.shortMessage);
    this.name = 'LiquidHTMLParsingError';

    const lineCol = lineColumn((ohm as any).input).fromIndex(
      (ohm as any)._rightmostFailurePosition,
    );

    // Plugging ourselves into @babel/code-frame since this is how
    // the babel parser can print where the parsing error occured.
    // https://github.com/prettier/prettier/blob/cd4a57b113177c105a7ceb94e71f3a5a53535b81/src/main/parser.js
    if (lineCol) {
      this.loc = {
        start: {
          line: lineCol.line,
          column: lineCol.col,
        },
        end: {
          line: lineCol.line,
          column: lineCol.col,
        },
      };
    }
  }
}

export class LiquidHTMLASTParsingError extends SyntaxError {
  loc?: { start: LineColPosition; end: LineColPosition };

  constructor(
    message: string,
    source: string,
    startIndex: number,
    endIndex: number,
  ) {
    super(message);
    this.name = 'LiquidHTMLParsingError';

    const lc = lineColumn(source);
    const start = lc.fromIndex(startIndex);
    const end = lc.fromIndex(endIndex);

    // Plugging ourselves into @babel/code-frame since this is how
    // the babel parser can print where the parsing error occured.
    // https://github.com/prettier/prettier/blob/cd4a57b113177c105a7ceb94e71f3a5a53535b81/src/main/parser.js
    if (!start || !end) return;
    this.loc = {
      start: {
        line: start!.line,
        column: start!.col,
      },
      end: {
        line: end!.line,
        column: end!.col,
      },
    };
  }
}

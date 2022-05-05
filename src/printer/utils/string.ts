import {
  LiquidAstPath,
  LiquidHtmlNode,
  LiquidParserOptions,
  TextNode,
} from '~/types';
import { first, last } from './array';

export function isWhitespace(source: string, loc: number): boolean {
  if (loc < 0 || loc >= source.length) return false;
  return !!source[loc].match(/\s/);
}

export const trim = (x: string) => x.trim();
export const trimEnd = (x: string) => x.trimEnd();

export function words(node: TextNode) {
  return node.value.trim().split(/\s+/).filter(Boolean);
}

export function hasOnlyOneWord(node: TextNode) {
  return words(node).length === 1;
}

export function firstWord(node: TextNode) {
  return first(words(node));
}

export function lastWord(node: TextNode) {
  return last(words(node));
}

export function bodyLines(str: string): string[] {
  return str
    .replace(/^\n*|\s*$/g, '') // only want the meat
    .split(/\r?\n/);
}

export function markupLines<
  T extends Extract<LiquidHtmlNode, { markup: string }>,
>(node: T): string[] {
  return node.markup.trim().split('\n');
}

export function reindent(lines: string[], skipFirst = false): string[] {
  const minIndentLevel = lines
    .filter((_, i) => (skipFirst ? i > 0 : true))
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/) as any)[0].length)
    .reduce((a, b) => Math.min(a, b), Infinity);

  if (minIndentLevel === Infinity) {
    return lines;
  }

  const indentStrip = ' '.repeat(minIndentLevel);
  return lines.map((line) => line.replace(indentStrip, '')).map(trimEnd);
}

export function originallyHadLineBreaks(
  path: LiquidAstPath,
  { locStart, locEnd }: LiquidParserOptions,
): boolean {
  const node = path.getValue();
  return hasLineBreakInRange(node.source, locStart(node), locEnd(node));
}

export function hasLineBreakInRange(
  source: string,
  locStart: number,
  locEnd: number,
): boolean {
  const indexOfNewLine = source.indexOf('\n', locStart);
  return 0 <= indexOfNewLine && indexOfNewLine < locEnd;
}

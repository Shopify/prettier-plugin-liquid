import { Parser, ParserOptions } from 'prettier';
import { toLiquidHtmlAST, LiquidHtmlNode } from './ast';

function parse(
  text: string,
  _parsers: Parsers,
  _opts: ParserOptions<LiquidHtmlNode>,
): LiquidHtmlNode {
  return toLiquidHtmlAST(text);
}

function locStart(node: LiquidHtmlNode) {
  return node.position.start;
}

function locEnd(node: LiquidHtmlNode) {
  return node.position.end;
}

export const liquidHtmlAstFormat = 'liquid-html-ast';

export const liquidHtmlLanguageName = 'liquid-html';

export const liquidHtmlParser: Parser<LiquidHtmlNode> = {
  parse,
  astFormat: liquidHtmlAstFormat,
  locStart,
  locEnd,
};

export interface Parsers {
  [languageName: string]: Parser;
}
